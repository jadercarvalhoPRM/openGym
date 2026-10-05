# Gate CodeRabbit — openGym

Estado em 2026-10-05: **WAIVED pelo humano; review NÃO EXECUTADO**. Não existe resultado PASS CodeRabbit.

Decisão humana explícita mais recente: **“faça sem o CodeRabbit, pq a minha conta é pessoal”**. Substitui a exigência anterior da ferramenta e autoriza prosseguir sem essa revisão. QA independente, E2E, CI e Docker continuam obrigatórios. O listener OAuth exclusivo desta tarefa foi encerrado, sem alterar contas, termos ou Apps GitHub. UCP está explicitamente fora do escopo e intocável.

Os registros abaixo preservam o histórico anterior à dispensa; não representam gates atuais nem êxito da revisão.

## Runtime oficial e integridade

A instrução legada AIOX usa WSL. WSL não está instalado. A CLI oficial atual oferece Windows nativo; foi usado esse runtime mantendo a ferramenta e o gate exigidos. Nenhum installer PowerShell baixado foi executado, nenhum PATH global alterado, nenhuma instalação WSL/Docker ou reboot realizado.

- Fonte oficial versionada: `https://cli.coderabbit.ai/releases/0.8.2/coderabbit-windows-x64.zip`.
- Binário user-local: `C:/Users/jader/AppData/Local/Codex/openGym/coderabbit-0.8.2/coderabbit.exe`.
- CLI `--version`: `0.8.2`.
- Authenticode antes da execução: **Valid**, assinante `CN=CodeRabbit Inc., O=CodeRabbit Inc., L=San Francisco, S=California, C=US`.
- SHA256 executável: `7BDE89B7D4B6B9CBD342FF879330C62125A9FBA7EC7D1C0673CAC45B723C4D42`.
- Documentação: [CodeRabbit CLI oficial](https://docs.coderabbit.ai/cli).

Uma tentativa de baixar o script installer para inspeção foi rejeitada pela revisão automática de aprovação (`blocked by policy`, sem motivo detalhado retornado). A alternativa foi pacote binário oficial versionado, assinatura válida verificada antes da execução e instalação somente no diretório do usuário. Não houve execução de script remoto nem contorno por ofuscação.

## Entrada sem segredos históricos

`scripts/prepare-coderabbit-review.mjs` constrói um Git **novo** temporário. Baseline e conteúdo atual excluem runtime e histórico: `data`, `.env` real, backups, mídia binária, dependências, relatórios e objetos Git upstream. Assim nem o patch de exclusão das chaves públicas upstream é enviado ao revisor. A retirada do tracking é validada separadamente por inventário Git.

`reports/coderabbit-input.json` contém caminhos e SHA256 de 179 arquivos source atuais copiados byte a byte, referência ao baseline público e digest da entrada. O scan proporcional procura padrões PEM/private keys, tokens GitHub, AWS e Cloudflare; **zero achados**. Isso não afirma ausência universal de segredos de qualquer formato.

## Autenticação e próximo passo

`auth login --agent --no-browser` está aguardando callback localhost no Chrome. A UI solicita login GitHub e informa aceite de Terms of Use ao continuar; etapa deixada ao humano. Não foi instalado GitHub App nem concedido acesso a outros repositórios. `auth status` confirma **signed out** até agora.

Após callback e `auth status` autenticado, executar `review --uncommitted --include-untracked --agent --dir <cópia sanitizada>`, usando limite gratuito sem `--use-credits`. Capturar resultado real e severidades; corrigir bloqueadores e revalidar. Nenhum resultado CodeRabbit pode ser inferido de instalação ou login.

## Diagnóstico de login — segunda tentativa

Humano informou que não consegue autenticar. Inspeção real encontrou a aba antiga no cadastro `free-trial` com GitHub Enterprise selecionado, depois na documentação GitHub de restrições OAuth. Nenhum erro concreto do serviço foi mostrado nessa página. O fluxo antigo CLI havia expirado: `Automatic login timed out. The localhost callback is no longer available.` Portanto sua URL anterior não pode ser reutilizada.

`coderabbit doctor`: **8 PASS, 1 WARN (signed out), 0 FAIL**. Runtime Windows, storage, Git, backend e WebSocket reachable; ausência de WSL não é a causa do login. Fluxo OAuth novo criado no diretório openGym; aba Chrome `235758322` usa GitHub Cloud e callback localhost ativo. A conta não foi trocada nem houve instalação de App, grant de repositório, subscription ou acesso UCP. Auth ainda pendente.

A política explícita do navegador (`cua.rewriteDocumentation`, Computer Use Confirmation Policy, Confirmation Required at Action time) exige confirmação no ato para aceite de Terms of Service. O botão Cloud informa aceite ao continuar; o gesto humano/consentimento concreto foi solicitado pela coordenação, sem sugerir dispensa do CodeRabbit.
