# Investe Valor

![Investe Valor](./public/brand/investe-valor-logo.png)

Aplicação web de controle financeiro pessoal completo: contas, cartões, orçamento, metas e fluxo de caixa no dia a dia, além do acompanhamento de investimentos de renda fixa — **CDB, LCI, LCA, LC, Tesouro Direto (Selic, Prefixado, IPCA+) e Poupança**.

📘 [Manual do usuário](./docs/MANUAL-DO-USUARIO.md) — como usar o painel, lançar movimentações, planejar o orçamento, cadastrar investimentos e entender os cálculos de rendimento, IR e IOF.

---

![Cortexis](./public/brand/cortexis-logo-small.png) Desenvolvido por **[Cortexis](https://cortexists.com)** — [cortexists.com](https://cortexists.com)

---

## Funcionalidades

### Dia a dia (contas, cartões e lançamentos)

- **Painel financeiro** com saldo consolidado, faturas do mês, saldo livre até o fim do mês, lançamento rápido, próximos vencimentos (7 dias) e barras de progresso dos tetos de categoria.
- **Lançamento rápido** de receitas, despesas e transferências entre contas em poucos cliques (modal compacto no painel).
- **Contas ilimitadas**: corrente, poupança, carteira e cartão de crédito, com saldo consolidado e extrato por conta ou geral.
- **Cartões de crédito**: limite comprometido vs. disponível, fatura aberta e dia de vencimento.
- **Compras parceladas**, divididas automaticamente ao longo dos meses seguintes.
- **Transferências** entre contas, refletidas nos dois lados do extrato.
- **Categorização em 2 níveis** (categoria principal + subcategoria) e **tags** livres para agrupar gastos (`#viagem-ferias`, `#trabalho`, ...).

### Planejamento e fluxo de caixa

- **Orçamento por teto** mensal por categoria, com progresso em tempo real.
- **Recorrências** (contas fixas e receitas recorrentes) com lista de próximos vencimentos.
- **Projeção de fluxo de caixa** para 30, 60 e 90 dias, com base nas recorrências ativas.
- **Simulador de decisão**: impacto anual de uma nova despesa recorrente sobre a renda.
- **Metas e reserva de emergência**: caixinhas para objetivos (viagem, carro, IPVA...) e acompanhamento de quantos meses de custo de vida a reserva cobre.
- **Taxa de poupança automática**: percentual da renda líquida retido no mês.

### Patrimônio e investimentos

- **Cadastro de investimentos** (CRUD completo): instituição, indexador, taxa, valor aplicado, datas de aplicação/vencimento, liquidez e cobertura do FGC.
- **Cálculo automático** do valor líquido estimado de cada investimento, considerando:
  - Indexadores CDI, Selic, IPCA+ e prefixado, com capitalização em dias úteis (base 252).
  - Tabela regressiva de **Imposto de Renda** (22,5% a 15%, conforme prazo).
  - **IOF regressivo** para resgates com menos de 30 dias.
  - **Isenção de IR** para LCI, LCA e Poupança.
- **Patrimônio consolidado multi-moeda** (BRL, USD, EUR) e multi-instituição, com lançamento mensal, aportes/retiradas e importação de planilha `.xlsx`.
- **Dashboard do patrimônio** com evolução mensal, composição por moeda e concentração por instituição.

### Plataforma

- **Configurações** para atualizar as taxas atuais de CDI, Selic, IPCA e cotações de USD/EUR usadas nas projeções.
- **Criptografia em repouso** com AES-256-GCM antes de gravar no banco: nos investimentos (nome, instituição, taxa, valor, observações), no módulo financeiro (nome/instituição/limite das contas, valor/descrição/observações/tags das movimentações, e valores de recorrências, orçamentos e metas) e nos valores do Patrimônio (saldo, aportes e retiradas mensais). Nomes de categorias e a instituição/aplicação de cada linha do Patrimônio ficam em texto plano — são identificadores usados para localizar e atualizar o lançamento certo, não segredos numéricos. Ver [Estrutura](#estrutura).
- **Login com autenticação própria** (e-mail/senha, recuperação por e-mail, 2FA via TOTP).
- **Licenciamento por chave** — o app só libera o uso depois de ativado com uma chave de licença assinada digitalmente (Ed25519), validada localmente sem precisar de internet.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router, TypeScript)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Prisma ORM 7](https://www.prisma.io/) + SQLite (via `@prisma/adapter-better-sqlite3`)
- [Recharts](https://recharts.org/) para os gráficos
- [Zod](https://zod.dev/) para validação

## Instaladores para Windows e Mac (para quem vende)

A forma mais simples de entregar o Investe Valor a um cliente é gerar um instalador de verdade — um `.exe` (Windows) ou `.dmg` (Mac) que ele baixa, instala e abre como qualquer programa, sem terminal e sem saber que existe Node.js por trás. O app roda dentro de um shell [Electron](https://www.electronjs.org/), que sobe o mesmo servidor Next.js localmente e abre uma janela apontando para ele.

**Os instaladores são construídos no GitHub Actions**, não localmente — build de Mac (`.dmg`) só funciona de verdade numa máquina Mac real, e o workflow já cuida disso com runners `windows-latest` e `macos-latest` de verdade. Para gerar uma nova versão:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Isso dispara `.github/workflows/build-desktop.yml`, que builda os dois instaladores em paralelo e os deixa disponíveis como artefatos da execução (aba **Actions** do repositório → a execução do workflow → **Artifacts**, no fim da página). Também dá para disparar manualmente pela aba Actions (**Run workflow**), sem precisar criar uma tag, útil pra testar antes de lançar uma versão de verdade.

Cada instalador já embarca o app inteiro (servidor Next.js, Prisma/SQLite, criptografia, tela de ativação) — o cliente só precisa da chave de licença de sempre (veja [Licenciamento](#licenciamento-para-quem-vende) abaixo).

**Sobre os avisos de segurança:** os instaladores não são assinados digitalmente por enquanto (assinatura exige certificado pago — no Windows, um certificado de code-signing; no Mac, uma conta Apple Developer paga + notarização). Sem isso, o sistema operacional avisa:
- **Windows**: SmartScreen mostra "Windows protegeu seu PC" — o cliente clica em **Mais informações** e depois **Executar assim mesmo**.
- **Mac**: Gatekeeper recusa abrir de primeira ("desenvolvedor não identificado") — o cliente vai em **Ajustes do Sistema → Privacidade e Segurança**, encontra o aviso sobre o Investe Valor e clica em **Abrir Assim Mesmo**.

Isso é normal para software não assinado e não afeta o funcionamento do app — só exige esse passo extra na primeira abertura.

## Instalação via terminal (alternativa)

Requer [Node.js](https://nodejs.org/) 20 ou mais recente instalado. Depois de obter o código:

```bash
npm run setup    # cria o .env com uma chave de criptografia nova, instala tudo,
                  # aplica as migrations do banco e gera o build de produção
npm run start     # inicia o app em http://localhost:3000
```

Na primeira vez que abrir o app, ele vai pedir a **chave de licença** recebida na compra — cole-a na tela de ativação para liberar o uso. Veja o [manual do usuário](./docs/MANUAL-DO-USUARIO.md) para o passo a passo completo.

`npm run setup` nunca sobrescreve um `.env` já existente — pode rodar de novo com segurança depois de atualizar o código, sem perder a chave de criptografia nem os dados.

### Desenvolvimento

Para trabalhar no código-fonte (não para uso normal do app):

```bash
cp .env.example .env
# gere uma chave e cole em ENCRYPTION_KEY dentro do .env:
openssl rand -base64 32

npm install           # instala dependências e gera o Prisma Client
npm run db:migrate    # cria o banco SQLite local (dev.db) e aplica as migrations
npm run dev            # inicia o servidor de desenvolvimento em http://localhost:3000
```

`ENCRYPTION_KEY` é obrigatória — sem ela, qualquer leitura ou escrita de investimento falha. Trate-a como um segredo: se for perdida, os dados já criptografados no banco ficam irrecuperáveis; se vazar, alguém com acesso ao arquivo `dev.db` consegue decifrar os dados. Nunca a commite (o `.env` já está no `.gitignore`).

Outros comandos úteis:

```bash
npm run build      # build de produção
npm run start      # roda o build de produção
npm run lint       # lint
npm run db:studio  # abre o Prisma Studio para inspecionar o banco
```

## Licenciamento (para quem vende)

O app só funciona depois de ativado com uma chave de licença. As chaves são assinadas com uma chave privada Ed25519 que **só quem vende** deve ter — o app embarca apenas a chave pública, usada para validar (não para criar) licenças, então essa verificação funciona sem internet.

Gerar o par de chaves e emitir licenças é feito por uma ferramenta separada deste repositório —
**[`license-generator`](../license-generator)** — com interface gráfica própria (Electron), pensada
para nunca conviver com o código que vai para o cliente. Veja o README dela para o passo a passo.

Resumo do fluxo:

1. Na ferramenta, gere um novo par de chaves (ou selecione um `.pem` já existente) — a chave
   privada é salva onde você escolher, fora deste repositório, e nunca fica dentro dele. Guarde-a
   em um cofre de senhas: se ela vazar, qualquer pessoa pode gerar licenças válidas; se for
   perdida, você não consegue mais emitir licenças novas (as já emitidas continuam válidas).
2. Cole em `src/lib/license-public-key.ts` o trecho de chave pública que a ferramenta gera —
   é seguro versionar, só permite *verificar* licenças, não criar novas.
3. Para cada venda, preencha nome/e-mail/validade na ferramenta e copie a chave de licença gerada
   (uma string longa começando com `IV1.`) — envie essa string ao cliente. Ela já contém os dados
   codificados e assinados; não é preciso guardar nada além da própria chave privada.

## Estrutura

```
prisma/schema.prisma          modelos: Investment, PortfolioEntry, BankAccount, BankTransaction,
                               Recurrence, Budget, Goal, ExpenseCategory, User, Settings...
src/lib/crypto.ts             criptografia AES-256-GCM (ENCRYPTION_KEY), compartilhada por todos os módulos
src/lib/investments-repo.ts   único ponto de acesso a Investment; cifra/decifra na borda
src/lib/investment-calc.ts    motor de cálculo de investimentos (rendimento, IR, IOF)
src/lib/bank-repo.ts          único ponto de acesso a BankAccount/BankTransaction; cifra/decifra na borda
src/lib/finance.ts            monta o snapshot do painel financeiro; único ponto de acesso a
                               Recurrence/Budget/Goal, também cifrando/decifrando na borda
src/lib/portfolio-repo.ts     único ponto de acesso a PortfolioEntry; cifra/decifra na borda
src/lib/auth.ts               sessões, login, 2FA (TOTP) e recuperação de senha
src/lib/license.ts            validação de chave de licença (Ed25519)
src/app/                      páginas: painel (/), conta, planejamento, investimentos, patrimônio,
                               dashboard, configurações, login/cadastro, ativação
src/app/api/                  rotas REST: transactions, accounts, budgets, recurrences, goals,
                               categories, investments, portfolio, settings, auth, license
src/components/               componentes de UI
scripts/setup.mjs             instalação em um comando (npm run setup)
electron/main.js               processo principal do app desktop (Electron)
electron/migrate.js            cria o banco na primeira execução do app desktop
.github/workflows/build-desktop.yml  builda os instaladores .exe/.dmg no CI
```

> Linhas gravadas antes de um campo passar a ser cifrado (ou restauradas de um backup antigo) se auto-migram: na primeira leitura, o valor em texto plano é decifrado com um fallback tolerante e regravado já cifrado — não é preciso rodar nenhum script manual.
