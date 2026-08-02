"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Save, Star, Trash2, UploadCloud, X } from "lucide-react";

import type { Category, Product, ProductImage, ProductInput } from "@/lib/types";

type ProductEditorProps = {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
};

function priceInput(cents: number) {
  return (cents / 100).toFixed(2);
}

export function AdminProductEditor({ product, categories, onClose, onSaved }: ProductEditorProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? priceInput(product.priceCents) : "");
  const [prepMinutes, setPrepMinutes] = useState(String(product?.prepMinutes ?? 20));
  const [highlight, setHighlight] = useState(product?.highlight ?? "");
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable ?? true);
  const [featured, setFeatured] = useState(Boolean(product?.featured));
  const [images, setImages] = useState<ProductImage[]>(product?.images ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function buildInput(): ProductInput | null {
    const parsedPrice = Number(price.replace(",", "."));
    const parsedPrep = Number(prepMinutes);
    if (name.trim().length < 2) {
      setError("Informe o nome do produto.");
      return null;
    }
    if (!categoryId) {
      setError("Selecione uma categoria.");
      return null;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Informe um preço válido.");
      return null;
    }
    if (!Number.isInteger(parsedPrep) || parsedPrep < 0 || parsedPrep > 240) {
      setError("Informe um tempo de preparo entre 0 e 240 minutos.");
      return null;
    }
    return {
      categoryId,
      name: name.trim(),
      description: description.trim(),
      priceCents: Math.round(parsedPrice * 100),
      prepMinutes: parsedPrep,
      isAvailable,
      featured,
      highlight: highlight.trim() || undefined,
    };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = buildInput();
    if (!input) return;
    setBusy("save");
    setError("");
    try {
      const formData = new FormData();
      formData.set("payload", JSON.stringify(input));
      files.forEach((file) => formData.append("images", file));
      const response = await fetch(product ? `/api/v1/admin/products/${product.id}` : "/api/v1/admin/products", {
        method: product ? "PUT" : "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar o produto.");
      setFiles([]);
      setImages(result.product?.images ?? images);
      await onSaved(result.warning || (product ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso."));
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar o produto.");
    } finally {
      setBusy("");
    }
  }

  async function setMain(imageId: string) {
    if (!product) return;
    setBusy(imageId);
    try {
      const response = await fetch(`/api/v1/admin/products/${product.id}/images/${imageId}`, { method: "PATCH" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível definir a foto principal.");
      setImages((current) => current.map((image) => ({ ...image, isMain: image.id === imageId })));
      await onSaved("Foto principal atualizada.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível definir a foto principal.");
    } finally {
      setBusy("");
    }
  }

  async function removeImage(imageId: string) {
    if (!product || !window.confirm("Remover esta foto do produto?")) return;
    setBusy(imageId);
    try {
      const response = await fetch(`/api/v1/admin/products/${product.id}/images/${imageId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível remover a foto.");
      setImages((current) => current.filter((image) => image.id !== imageId));
      await onSaved("Foto removida.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível remover a foto.");
    } finally {
      setBusy("");
    }
  }

  async function removeProduct() {
    if (!product || !window.confirm(`Excluir "${product.name}" definitivamente?`)) return;
    setBusy("delete-product");
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/products/${product.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir o produto.");
      await onSaved("Produto excluído do cardápio.");
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível excluir o produto.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="admin-product-modal" role="dialog" aria-modal="true" aria-labelledby="product-editor-title">
        <header className="product-editor-header">
          <div>
            <p className="eyebrow">Cardápio</p>
            <h2 id="product-editor-title">{product ? "Editar produto" : "Novo produto"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={19}/></button>
        </header>

        <form onSubmit={submit} className="product-editor-form">
          {error && <p className="product-editor-error">{error}</p>}
          <div className="product-editor-layout">
            <div className="product-editor-fields">
              <section className="editor-section">
                <div className="editor-section-title"><strong>Informações do produto</strong><small>O cliente verá estes dados no cardápio.</small></div>
                <div className="editor-field-grid">
                  <label className="editor-field editor-field-wide"><span>Nome *</span><input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Dog Bacon Especial" autoFocus/></label>
                  <label className="editor-field"><span>Categoria *</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                  <label className="editor-field"><span>Preço *</span><div className="money-input"><span>R$</span><input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0,00"/></div></label>
                  <label className="editor-field editor-field-wide"><span>Ingredientes e descrição</span><textarea value={description} maxLength={1200} rows={5} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva pão, recheios, molhos e acompanhamentos."/></label>
                  <label className="editor-field"><span>Tempo de preparo</span><div className="suffix-input"><input type="number" min="0" max="240" value={prepMinutes} onChange={(event) => setPrepMinutes(event.target.value)}/><span>min</span></div></label>
                  <label className="editor-field"><span>Selo no card</span><input value={highlight} maxLength={40} onChange={(event) => setHighlight(event.target.value)} placeholder="Ex.: Mais pedido"/></label>
                </div>
              </section>

              <section className="editor-section">
                <div className="editor-section-title"><strong>Visibilidade</strong><small>Controle onde o produto aparece.</small></div>
                <div className="editor-toggles">
                  <label><input type="checkbox" checked={isAvailable} onChange={(event) => setIsAvailable(event.target.checked)}/><span><b>Produto ativo</b><small>Disponível para compra no cardápio</small></span></label>
                  <label><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)}/><span><b>Exibir no showcase</b><small>Usa a foto principal no banner da home</small></span></label>
                </div>
              </section>
            </div>

            <aside className="product-editor-media">
              <section className="editor-section">
                <div className="editor-section-title"><strong>Fotos do produto</strong><small>Você pode enviar mais fotos sempre que editar.</small></div>
                {images.length > 0 && <div className="product-gallery-admin">{images.map((image) => <article key={image.id} className={image.isMain ? "is-main" : ""}>
                  {/* Uploaded URLs may come from the configured Supabase Storage host. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt=""/>
                  {image.isMain && <span className="main-image-label"><Check size={12}/>Principal</span>}
                  <div className="gallery-image-actions">
                    {!image.isMain && <button type="button" disabled={busy === image.id} onClick={() => void setMain(image.id)} aria-label="Usar como foto principal" title="Usar como principal"><Star size={15}/></button>}
                    <button type="button" className="danger" disabled={busy === image.id} onClick={() => void removeImage(image.id)} aria-label="Remover foto" title="Remover foto"><Trash2 size={15}/></button>
                  </div>
                </article>)}</div>}

                <label className="product-upload-area">
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))}/>
                  <UploadCloud size={27}/>
                  <b>Escolher fotos</b>
                  <span>Galeria ou câmera do celular</span>
                  <small>Até 12 por envio, 8 MB cada</small>
                </label>
                {previews.length > 0 && <div className="new-image-previews">{previews.map((url, index) => <div key={url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Nova foto ${index + 1}`}/>
                </div>)}</div>}
                {files.length > 0 && <button type="button" className="clear-files" onClick={() => setFiles([])}><X size={14}/>Limpar {files.length} {files.length === 1 ? "foto" : "fotos"}</button>}
              </section>
            </aside>
          </div>

          <footer className="product-editor-footer">
            {product && <button className="button editor-delete-product" type="button" disabled={busy === "delete-product"} onClick={() => void removeProduct()}><Trash2 size={16}/>Excluir</button>}
            <button className="button button-ghost" type="button" onClick={onClose}>Cancelar</button>
            <button className="button button-dark" type="submit" disabled={busy === "save"}><Save size={16}/>{busy === "save" ? "Salvando..." : "Salvar produto"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
