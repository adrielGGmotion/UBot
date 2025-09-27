# Como Configurar a Monitoração do GitHub

Este guia explica como configurar as notificações do GitHub no seu servidor Discord usando a dashboard do bot. O processo tem duas partes: configurar um **Webhook** no seu repositório do GitHub e, em seguida, configurar as opções na **dashboard** do bot.

## Parte 1: Configuração no GitHub (Para Cada Repositório)

Para que o bot receba os eventos do seu repositório, você precisa criar um "Webhook".

1.  **Navegue até o seu repositório** no GitHub.
2.  Vá para **Settings** (Configurações) no menu superior do repositório.
3.  Na barra lateral esquerda, clique em **Webhooks**.
4.  Clique no botão **Add webhook** (Adicionar webhook).

Agora, preencha o formulário do webhook com as seguintes informações:

*   **Payload URL**: Esta é a URL para onde o GitHub enviará os eventos. Ela deve ser a URL da sua dashboard, seguida por `/api/webhooks/github`.
    *   Exemplo: `https://seu-dominio-do-bot.com/api/webhooks/github`

*   **Content type**: Selecione `application/json`.

*   **Secret**: Este é um campo de segurança crucial.
    *   Crie uma senha forte e aleatória (por exemplo, usando um gerador de senhas).
    *   Cole esta senha no campo "Secret".
    *   **Guarde esta senha!** Você precisará inseri-la exatamente igual na dashboard do bot.

*   **Which events would you like to trigger this webhook?** (Quais eventos devem acionar este webhook?): Selecione **"Send me everything"** (Envie-me tudo) para a configuração mais simples, ou selecione **"Let me select individual events"** (Deixe-me selecionar eventos individuais) e marque as seguintes caixas:
    *   `Pushes` (para commits)
    *   `Issues`
    *   `Pull requests`
    *   `Releases`

5.  Verifique se a opção **"Active"** está marcada.
6.  Clique em **Add webhook**.

Se tudo estiver correto, você verá o novo webhook na lista com um tique verde (✓), indicando que o GitHub conseguiu se comunicar com a sua `Payload URL`.

## Parte 2: Configuração na Dashboard

Depois de configurar o webhook no GitHub, vá para a dashboard do bot para configurar como as notificações aparecerão no seu servidor.

1.  **Acesse a página de configurações** do seu servidor na dashboard.
2.  No menu de navegação lateral, clique em **GitHub**.
3.  Clique no botão **Configure GitHub Monitoring**.

### Adicionando um Repositório

1.  Clique em **Add Repository**.
2.  Preencha os campos no modal:
    *   **GitHub Repository URL**: A URL completa do repositório que você configurou (ex: `https://github.com/usuario/repositorio`).
    *   **Webhook Secret**: A mesma senha secreta que você criou no GitHub na etapa anterior.

### Configurando as Notificações

Após adicionar o repositório, você pode clicar em **Edit** para configurar as notificações em detalhe.

*   **Global Repo Status**: Um interruptor geral para ativar ou desativar todas as notificações deste repositório.

#### Seção de Commits
- **Enabled**: Ativa/desativa as notificações para novos commits.
- **Notification Channel**: O canal do Discord para onde as mensagens de commit serão enviadas.
- **Branch Filter**: Filtra os commits por branch.
  - **Mode**: `Blacklist` (ignorar branches na lista) ou `Whitelist` (apenas notificar sobre branches na lista).
  - **List**: Lista de branches separadas por vírgula (ex: `main, develop`).
- **Message Filter**: Filtra com base na mensagem do commit. Útil para ignorar commits automáticos ou de rotina (ex: `WIP, chore, docs`).
- **Author Filter**: Filtra com base no nome de usuário do autor do commit no GitHub. Útil para ignorar commits de bots.

#### Seção de Pull Requests
- **Enabled**: Ativa/desativa as notificações para pull requests.
- **Notification Channel**: O canal para onde as notificações de PRs serão enviadas.
- **Ignore Draft PRs**: Se marcado, não enviará notificações sobre PRs que estão em modo "Draft" (Rascunho).
- **Base Branch Filter**: Só notifica sobre PRs que têm como alvo as branches especificadas (ex: `main`).
- **Label Filter**: Filtra PRs com base em suas labels no GitHub.

#### Seção de Issues
- **Enabled**: Ativa/desativa as notificações para issues.
- **Notification Channel**: O canal para onde as notificações de issues serão enviadas.
- **Label Filter**: Filtra issues com base em suas labels.

#### Seção de Releases
- **Enabled**: Ativa/desativa as notificações para novas releases.
- **Notification Channel**: O canal para onde as notificações de releases serão enviadas.

Depois de ajustar todas as configurações, clique em **Save** no modal. Suas configurações estão prontas, e o bot começará a enviar as notificações conforme você especificou!