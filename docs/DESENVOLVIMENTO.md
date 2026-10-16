# Guia de instalação, execução e manutenção

Este guia explica como obter o PDV Layout Studio pelo GitHub, executar no computador e alterar seu código. Os comandos devem ser executados no terminal, dentro da pasta que contém o arquivo package.json, salvo indicação diferente.

## 1. Preparar o computador

Instale:

- **Node.js 22.12 ou superior da linha 22, ou Node.js 24**, com npm: [nodejs.org](https://nodejs.org/). O Vite instalado exige Node.js 20.19+ ou 22.12+; para executar também os testes com a configuração atual, use Node.js 22.12+ ou 24.
- **Git**, para clonar e versionar: [git-scm.com](https://git-scm.com/).
- Um editor, por exemplo [Visual Studio Code](https://code.visualstudio.com/).

Após instalar, abra um novo terminal e confira:

~~~sh
node --version
npm --version
git --version
~~~

No Windows, pode usar o terminal do VS Code, PowerShell ou Prompt de Comando. Se algum comando não for reconhecido, reabra o terminal e verifique a instalação e o PATH.

## 2. Baixar o projeto do GitHub

### Opção A: clonar com Git — indicada para desenvolvimento

Abra a página do repositório no GitHub, clique em **Code → HTTPS** e copie o endereço. Substitua o endereço de exemplo abaixo pelo endereço real do repositório:

~~~sh
git clone https://github.com/cristianosolutions/pdv-layout.git pdv-layout-studio
cd pdv-layout-studio
~~~

Repositórios privados exigem acesso autorizado e autenticação do GitHub. Para contribuir em um repositório em que você não tem permissão de escrita, crie um fork e clone o seu fork.

### Opção B: baixar ZIP

Na página do repositório, clique em **Code → Download ZIP** e extraia o arquivo. Abra a pasta extraída no editor e no terminal. Não execute o projeto dentro do ZIP nem edite arquivos temporários criados pelo descompactador.

O ZIP permite executar e modificar os arquivos, mas não traz o histórico Git. Para branches, commits e atualizações com git pull, prefira clonar.

## 3. Instalar as dependências

Na pasta do projeto:

~~~sh
npm ci
~~~

Esse comando instala as versões registradas em package-lock.json. Use-o na primeira instalação e após receber mudanças nas dependências. Ele recria node_modules; não guarde arquivos próprios nessa pasta.

A instalação exige acesso à internet ou pacotes já disponíveis no cache do npm. Não é necessário instalar React, TypeScript ou Vite globalmente.

## 4. Rodar no computador

~~~sh
npm run dev
~~~

Abra no navegador o endereço mostrado no terminal, normalmente **http://localhost:5173/**. Se a porta estiver ocupada, o Vite poderá usar 5174 ou outra porta: use sempre o endereço exibido.

Mantenha o terminal aberto enquanto utiliza o editor. Para encerrar, pressione **Ctrl+C** no terminal. Para iniciar novamente, execute npm run dev.

O projeto atual é uma aplicação de navegador, sem backend, banco de dados ou arquivo .env obrigatório. Não abra index.html diretamente com duplo clique: use o servidor do Vite.

## 5. Entender a estrutura

| Arquivo ou pasta | Responsabilidade |
| --- | --- |
| src/main.tsx | Inicializa o React e carrega os estilos globais. |
| src/App.tsx | Interface principal, estado do projeto, propriedades, atalhos, seleção, histórico e comandos de abrir/salvar. |
| src/App.css | Layout do editor, barras, painéis, rolagem e aparência dos controles. |
| src/index.css | Estilos globais de html, body e raiz React. |
| src/components/PDVCanvas.tsx | Desenha os elementos com Konva; seleção por área, arraste, redimensionamento, rotação e guias. |
| src/components/BorderProperties.tsx | Controles de borda e cantos arredondados. |
| src/components/LayoutTools.tsx | Controles de alinhamento, distribuição e ordem das camadas. |
| src/types/editor.ts | Contratos TypeScript dos elementos e projetos. |
| src/utils/project.ts | Validação do JSON antes de carregar projetos. |
| src/utils/autosave.ts | Leitura e escrita do projeto no localStorage. |
| src/utils/exportImage.ts | Exportação PNG sem controles de seleção. |
| src/utils/layout.ts | Alinhamento, distribuição e ordem das camadas. |
| src/utils/resize.ts | Adaptação dos objetos ao mudar a resolução. |
| src/utils/snap.ts | Cálculo de encaixe nas guias. |
| src/templates/supermercado.ts | Carrega e valida o modelo Supermercado. |
| src/templates/supermercado.json | Dados do modelo, incluindo imagens embutidas. É usado pela aplicação. |
| src/experimental/rpdv | Protótipo de compatibilidade TXT, fora da interface principal. |
| tests | Testes automatizados das funções do editor e do protótipo. |
| public | Arquivos estáticos servidos diretamente, como favicon.svg. |
| vite.config.ts | Configuração do servidor e da compilação Vite. |
| tsconfig*.json | Configuração de TypeScript para aplicação e ferramentas. |
| eslint.config.js | Regras de análise do código. |
| package.json | Comandos e dependências. |
| package-lock.json | Versões exatas das dependências; deve acompanhar o código no Git. |
| node_modules | Dependências instaladas, geradas por npm ci; não editar nem enviar ao Git. |
| dist | Resultado de npm run build; não editar, pois é recriado na compilação. |

## 6. Modificar o projeto

### Criar uma branch

Se você clonou com Git, antes de alterar:

~~~sh
git status
git switch -c melhoria/minha-alteracao
~~~

Escolha um nome que descreva a mudança. Revise alterações locais existentes antes de começar.

### Editar e conferir no navegador

Abra a pasta inteira no editor. Se o comando do VS Code estiver disponível:

~~~sh
code .
~~~

Execute npm run dev, altere os arquivos em src e salve. O Vite normalmente atualiza a página automaticamente. Se mudar a configuração do Vite ou dependências, reinicie o servidor.

Exemplos de onde começar:

- **Cores, espaçamento ou rolagem:** src/App.css; estilos globais em src/index.css.
- **Botões e ações:** src/App.tsx; componentes específicos em src/components.
- **Novo tipo de objeto:** atualizar src/types/editor.ts, criação e propriedades em App.tsx, desenho em PDVCanvas.tsx e validação em utils/project.ts. Conferir também cópia, histórico, redimensionamento e exportação.
- **Nova resolução:** atualizar o mapa resolutions em App.tsx e conferir a adaptação em utils/resize.ts.
- **Novo modelo:** adicionar os dados em src/templates, validar com parseProject e conectar o carregamento na interface.
- **Formato salvo:** revisar types/editor.ts, utils/project.ts e utils/autosave.ts. Planejar compatibilidade com projetos antigos antes de mudar campos obrigatórios ou a versão do autosave.

As imagens do modelo Supermercado estão embutidas no JSON e contribuem para o tamanho da compilação. Não remova o JSON por parecer um arquivo grande ou duplicado.

O protótipo RPdv tem componente, conversor e CSS próprios. Ele não está acessível pela interface principal. Alterações nessa área devem preservar a codificação, as quebras de linha e os registros desconhecidos do TXT; confira os testes em tests/rpdv.test.mjs.

### Adicionar dependências, se necessário

~~~sh
npm install nome-do-pacote
~~~

Para ferramentas usadas apenas durante desenvolvimento:

~~~sh
npm install -D nome-do-pacote
~~~

Esses comandos atualizam package.json e package-lock.json. Inclua ambos no commit. Evite editar o lockfile manualmente.

## 7. Validar antes de entregar

Execute separadamente, verificando o resultado de cada comando:

~~~sh
npm run lint
npm test
npm run build
~~~

- **lint:** verifica regras e problemas de código.
- **test:** executa os testes em tests com o executor nativo do Node.js.
- **build:** verifica os tipos e gera a aplicação em dist.

A suíte atual tem 19 testes. Eles não substituem a verificação visual de mudanças na interface. Para alterações de lógica, acrescente testes que cubram o comportamento e os casos de erro relevantes.

Confira manualmente o fluxo afetado e, quando pertinente:

1. Adicionar texto, retângulo, campo e imagem.
2. Selecionar por clique, por área e por Selecionar todos.
3. Excluir vários objetos e recuperar com Desfazer.
4. Mover, redimensionar, girar e alterar propriedades.
5. Mudar resolução e zoom, incluindo 100%; conferir a rolagem e o rodapé.
6. Salvar JSON, abrir novamente e exportar PNG.
7. Recarregar a página e conferir o autosave.

Para visualizar a compilação de produção:

~~~sh
npm run build
npm run preview
~~~

Abra a URL exibida no terminal. O preview serve para conferir a compilação localmente; não é uma configuração de hospedagem de produção.

## 8. Salvar e compartilhar mudanças pelo GitHub

Após validar:

~~~sh
git status
git diff
~~~

Adicione somente os arquivos da alteração, por exemplo:

~~~sh
git add src/App.tsx src/App.css
git commit -m "Corrige rolagem do editor"
git push -u origin melhoria/minha-alteracao
~~~

A lista de arquivos e a branch acima são exemplos: ajuste ao seu trabalho. No GitHub, abra um Pull Request para a branch principal do repositório. Descreva o problema, a mudança e como foi validada. Para mudanças visuais, inclua imagens do resultado.

Não inclua node_modules, dist ou credenciais no commit. Confira git status e git diff antes de enviar.

## 9. Receber atualizações do repositório

Finalize ou guarde suas alterações locais antes de atualizar. Troque para a branch principal real do repositório, por exemplo main:

~~~sh
git switch main
git pull --ff-only
npm ci
~~~

Se a branch principal tiver outro nome, substitua main. Se o Git apontar divergência ou mudanças locais, resolva a situação antes de continuar; não descarte arquivos automaticamente.

Depois, execute as validações e inicie novamente com npm run dev. Se o projeto foi baixado por ZIP, baixe a nova versão em outra pasta e compare as alterações locais antes de substituí-las.

## 10. Dados do editor e problemas comuns

### Onde ficam meus layouts?

O autosave usa o localStorage do navegador. Ele não é um arquivo do repositório nem é enviado ao GitHub. Navegadores, perfis ou endereços diferentes têm armazenamento separado; mudar de localhost:5173 para localhost:5174 pode fazer a cópia automática anterior não aparecer.

Use **Salvar** para baixar um JSON antes de limpar os dados do navegador ou mudar de computador. Use **Abrir** para restaurar esse arquivo. O PNG é a imagem exportada; o JSON é o arquivo para continuar editando.

### Porta ocupada

Use a URL informada pelo Vite. Para escolher outra porta explicitamente:

~~~sh
npm run dev -- --port=5175
~~~

### PowerShell bloqueia npm.ps1

Execute npm.cmd no lugar de npm, por exemplo:

~~~powershell
npm.cmd ci
npm.cmd run dev
~~~

Isso permite usar o executável do npm sem alterar a política de execução do PowerShell.

### npm ci informa divergência no lockfile

Confirme que package.json e package-lock.json pertencem à mesma versão do projeto. Se você alterou dependências intencionalmente, execute npm install para atualizar o lockfile e revise ambos os arquivos. Para uma cópia recém-clonada, verifique se recebeu os dois arquivos corretos.

### Erro de módulo ou arquivo não encontrado

Confira o caminho do import, a existência do arquivo e as letras maiúsculas/minúsculas do nome. Um caminho aceito no Windows pode falhar em um ambiente Linux. Execute npm ci se o módulo ausente for uma dependência.

### Aviso sobre JavaScript maior que 500 kB

A compilação atual pode emitir esse aviso por causa do tamanho do código e do modelo com imagens embutidas. O aviso não impede a compilação, mas merece análise se houver lentidão no carregamento. Considere carregar modelos sob demanda ou separar recursos, validando abertura e exportação após a mudança.

### Aviso ExperimentalWarning nos testes

Algumas versões do Node.js emitem esse aviso ao usar --experimental-strip-types. Confira o resumo de testes: o aviso, sozinho, não indica falha.
