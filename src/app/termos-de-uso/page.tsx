import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChefHat, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Termos de uso | Dog do Chef",
  description: "Condições de uso do cardápio e dos pedidos da Dog do Chef.",
};

export default function TermsPage() {
  return <main className="legal-shell"><header className="legal-header"><Link href="/" className="brand-lockup"><span className="brand-mark"><ChefHat size={22}/></span><span><strong>Dog do Chef</strong><small>informações legais</small></span></Link><Link href="/" className="text-link"><ArrowLeft size={17}/>Voltar</Link></header><article className="legal-content"><p className="eyebrow"><FileText size={15}/>Condições de uso</p><h1>Termos de uso</h1><p className="legal-updated">Atualizados em 2 de agosto de 2026.</p><p>Estes termos organizam o uso do site e o envio de pedidos à Dog do Chef. Ao concluir um pedido, o cliente declara que informou dados verdadeiros e que concorda com estas condições.</p>
    <section><h2>Cardápio e disponibilidade</h2><p>Produtos, adicionais, preços e disponibilidade são os exibidos no momento do pedido. Itens podem ser pausados quando acabarem. Fotos são ilustrativas da apresentação e pequenas variações de preparo podem ocorrer.</p></section>
    <section><h2>Confirmação do pedido</h2><p>O envio pelo site registra uma solicitação. O pedido é aceito quando a administradora altera o status para confirmado. O cliente acompanha essa decisão em Meus pedidos ou na página de acompanhamento.</p></section>
    <section><h2>Entrega e retirada</h2><p>Na entrega, o cliente deve informar endereço e telefone válidos. A taxa padrão ou a exceção cadastrada para o bairro é apresentada no resumo. Para retirada, o pedido deve ser buscado no local indicado pela loja após a confirmação de que está pronto.</p></section>
    <section><h2>Pagamento</h2><p>As formas disponíveis aparecem no checkout. Pix depende da confirmação do gateway de pagamento. Dinheiro ou cartão na entrega são acertados no recebimento. O site não solicita nem armazena o número completo do cartão.</p></section>
    <section><h2>Cancelamento e ajustes</h2><p>Pedidos ainda não confirmados podem ser recusados por indisponibilidade, inconsistência de dados ou impossibilidade de atendimento. Depois do início do preparo, pedidos personalizados podem não admitir cancelamento. Situações excepcionais devem ser tratadas pelos canais oficiais da loja.</p></section>
    <section><h2>Conta do cliente</h2><p>O cliente é responsável por manter o acesso à conta protegido e por atualizar seus dados. O histórico exibido é restrito à conta autenticada ou ao link seguro de acompanhamento emitido no pedido.</p></section>
    <section><h2>Uso adequado</h2><p>Não é permitido tentar acessar pedidos de terceiros, contornar controles de segurança, automatizar pedidos abusivos ou usar o site para atividades ilícitas. Acesso indevido pode ser bloqueado.</p></section>
    <section><h2>Alterações e contato</h2><p>Estes termos podem ser atualizados conforme a operação evoluir. Dúvidas e solicitações devem ser encaminhadas pelos canais oficiais apresentados no site.</p></section>
    <nav className="legal-links"><Link href="/politica-de-privacidade">Ler a Política de privacidade</Link><Link href="/">Voltar ao cardápio</Link></nav>
  </article></main>;
}
