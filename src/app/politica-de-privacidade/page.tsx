import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChefHat, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de privacidade | Dog do Chef",
  description: "Como a Dog do Chef trata os dados usados em contas e pedidos.",
};

export default function PrivacyPolicyPage() {
  return <main className="legal-shell"><header className="legal-header"><Link href="/" className="brand-lockup"><span className="brand-mark"><ChefHat size={22}/></span><span><strong>Dog do Chef</strong><small>informações legais</small></span></Link><Link href="/" className="text-link"><ArrowLeft size={17}/>Voltar</Link></header><article className="legal-content"><p className="eyebrow"><ShieldCheck size={15}/>Privacidade</p><h1>Política de privacidade</h1><p className="legal-updated">Atualizada em 2 de agosto de 2026.</p><p>Esta política explica como a Dog do Chef utiliza os dados necessários para cadastrar clientes, receber pedidos e realizar entregas ou retiradas.</p>
    <section><h2>Dados utilizados</h2><p>Podemos tratar nome, telefone, e-mail, endereço de entrega, itens do pedido, forma e situação do pagamento, histórico de atendimento e dados técnicos básicos de sessão e segurança. O site não armazena dados completos de cartão.</p></section>
    <section><h2>Finalidades</h2><p>Os dados são usados para criar e proteger a conta, calcular a entrega, confirmar e preparar pedidos, apresentar o acompanhamento, processar pagamentos escolhidos, atender solicitações e cumprir obrigações legais.</p></section>
    <section><h2>Login com Google</h2><p>Quando essa opção é escolhida, recebemos do provedor de autenticação apenas os dados básicos autorizados, como identificador, nome e e-mail verificado. A senha da conta Google não é recebida nem armazenada pela Dog do Chef.</p></section>
    <section><h2>Compartilhamento</h2><p>Os dados podem ser processados por fornecedores indispensáveis à operação, como hospedagem, banco de dados, autenticação e gateway de pagamento. Cada serviço recebe somente o necessário para sua função. A Dog do Chef não vende dados pessoais.</p></section>
    <section><h2>Conservação e segurança</h2><p>Os registros são mantidos pelo período necessário à operação, segurança e cumprimento de obrigações. São adotados controles de acesso, conexões seguras e restrição de credenciais. Nenhum sistema elimina totalmente os riscos, mas incidentes são tratados com prioridade.</p></section>
    <section><h2>Direitos do titular</h2><p>Você pode solicitar confirmação de tratamento, acesso, correção e, quando aplicável, exclusão ou limitação dos dados. Solicitações devem ser feitas pelos canais oficiais apresentados no site.</p></section>
    <section><h2>Cookies e sessão</h2><p>O site usa cookies estritamente necessários para manter o acesso do cliente e do painel administrativo. Ao escolher o login com Google, cookies técnicos do fluxo de autenticação também podem ser utilizados.</p></section>
    <section><h2>Contato e alterações</h2><p>Dúvidas sobre privacidade podem ser enviadas pelos canais oficiais da Dog do Chef. Esta política pode ser atualizada para refletir mudanças legais ou operacionais, com a data da versão indicada no início.</p></section>
    <nav className="legal-links"><Link href="/termos-de-uso">Ler os Termos de uso</Link><Link href="/">Voltar ao cardápio</Link></nav>
  </article></main>;
}
