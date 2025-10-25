const { EmbedBuilder } = require('discord.js');

/**
 * Checks if a string matches any of a list of patterns with wildcards.
 * @param {string} text The string to check.
 * @param {string[]} patterns An array of patterns (e.g., 'feature/*').
 * @returns {boolean}
 */
function branchMatches(text, patterns) {
    if (!patterns || patterns.length === 0) return true;
    return patterns.some(pattern => {
        const regexPattern = pattern.replace(/([.+?^${}()|\[\]\/\\])/g, '\\$1').replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(text);
    });
}

/**
 * Envia uma mensagem de embed para um canal específico.
 * @param {Client} client O cliente Discord.
 * @param {string} channelId O ID do canal de destino.
 * @param {EmbedBuilder} embed O embed a ser enviado.
 * @param {string} guildId O ID da guild.
 */
async function sendMessage(client, channelId, embed, guildId) {
    if (!channelId) {
        console.error(`[GitHub Notifier] Tentativa de envio para um channelId nulo.`);
        return;
    }
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            const settings = await client.getGuildSettings(guildId);
            embed.setColor(embed.data.color || settings.colors.primary);
            await channel.send({ embeds: [embed] });
        } else {
            console.error(`[GitHub Notifier] Canal ${channelId} não encontrado ou não é um canal de texto.`);
        }
    } catch (error) {
        console.error(`[GitHub Notifier] Falha ao enviar mensagem para o canal ${channelId}:`, error);
    }
}

/**
 * Processa eventos de push (commit) do GitHub.
 * @param {Client} client O cliente Discord.
 * @param {object} config A configuração do repositório para a guild.
 * @param {object} payload O payload do evento do GitHub.
 * @param {string} guildId O ID da guild.
 */
function handlePushEvent(client, config, payload, guildId) {
    const { commits: commitConfig } = config;
    if (!commitConfig || !commitConfig.enabled || !payload.commits || payload.commits.length === 0) {
        return;
    }

    const branch = payload.ref.split('/').pop();

    // 1. Branch Filter
    const branchFilter = commitConfig.branchFilter || { mode: 'whitelist', list: [] };
    if (branchFilter.list && branchFilter.list.length > 0) {
        const isMatch = branchMatches(branch, branchFilter.list);

        if (branchFilter.mode === 'whitelist' && !isMatch) return;
        if (branchFilter.mode === 'blacklist' && isMatch) return;
    }

    const filteredCommits = payload.commits.filter(commit => {
        // Ignorar commits que são resultado de um merge de PR, pois eles geralmente têm seu próprio evento.
        if (commit.message.startsWith('Merge pull request')) return false;

        const authorName = commit.author.name;
        const authorInList = (commitConfig.authorFilter.list || []).map(a => a.toLowerCase()).includes(authorName.toLowerCase());
        if (commitConfig.authorFilter.mode === 'whitelist' && !authorInList) return false;
        if (commitConfig.authorFilter.mode === 'blacklist' && authorInList) return false;

        const commitMessage = commit.message;
        const messageMatches = (commitConfig.messageFilter.list || []).some(filter => commitMessage.toLowerCase().includes(filter.toLowerCase()));
        if (commitConfig.messageFilter.mode === 'whitelist' && !messageMatches) return false;
        if (commitConfig.messageFilter.mode === 'blacklist' && messageMatches) return false;

        return true;
    });

    if (filteredCommits.length === 0) return;

    // Cria um único embed para todos os commits no push
    const embed = new EmbedBuilder()
        .setColor(client.config.colors.accent1 || '#9900FF')
        .setAuthor({ name: payload.sender.login, iconURL: payload.sender.avatar_url, url: payload.sender.html_url })
        .setTitle(`[${payload.repository.name}:${branch}] ${filteredCommits.length} new commit(s)`)
        .setURL(payload.compare)
        .setTimestamp();

    const description = filteredCommits.map(commit =>
        `[\`${commit.id.slice(0, 7)}\`](${commit.url}) ${commit.message.split('\n')[0]} - ${commit.author.name}`
    ).join('\n');

    embed.setDescription(description.substring(0, 4000)); // Limita a descrição para evitar erros

    sendMessage(client, commitConfig.channelId, embed, guildId);
}

/**
 * Processa eventos de pull request do GitHub.
 * @param {Client} client O cliente Discord.
 * @param {object} config A configuração do repositório para a guild.
 * @param {object} payload O payload do evento do GitHub.
 * @param {string} guildId O ID da guild.
 */
function handlePullRequestEvent(client, config, payload, guildId) {
    const { pullRequests: prConfig } = config;
    if (!prConfig.enabled) return;

    const { action, pull_request: pr } = payload;

    // 1. Filtro de Evento
    if (!prConfig.eventFilter.includes(action)) return;

    // 2. Filtro de Rascunho (Draft)
    if (prConfig.ignoreDrafts && pr.draft) return;

    // 3. Filtro de Branch (Base e Head)
    const baseBranch = pr.base.ref;
    const headBranch = pr.head.ref;
    if (!branchMatches(baseBranch, prConfig.branchFilter.base)) return;
    if (!branchMatches(headBranch, prConfig.branchFilter.head)) return;

    // 4. Filtro de Labels
    const prLabels = pr.labels.map(label => label.name.toLowerCase());
    const filterLabels = prConfig.labelFilter.list.map(l => l.toLowerCase());
    const hasLabelMatch = filterLabels.some(filterLabel => prLabels.includes(filterLabel));

    if (prConfig.labelFilter.mode === 'whitelist' && !hasLabelMatch) return;
    if (prConfig.labelFilter.mode === 'blacklist' && hasLabelMatch) return;

    // 5. Construção do Embed
    let embedColor;
    let titleAction;
    switch (action) {
        case 'opened':
            embedColor = '#2da44e'; // Verde
            titleAction = `Pull Request Opened #${pr.number}`;
            break;
        case 'closed':
            if (pr.merged) {
                embedColor = '#8250df'; // Roxo
                titleAction = `Pull Request Merged #${pr.number}`;
            } else {
                embedColor = '#cf222e'; // Vermelho
                titleAction = `Pull Request Closed #${pr.number}`;
            }
            break;
        case 'reopened':
            embedColor = '#2da44e'; // Verde
            titleAction = `Pull Request Reopened #${pr.number}`;
            break;
        default:
            embedColor = client.config.colors.primary || '#000000';
            titleAction = `Pull Request #${pr.number} ${action}`;
    }

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`[${payload.repository.name}] ${titleAction}`)
        .setURL(pr.html_url)
        .setAuthor({ name: payload.sender.login, iconURL: payload.sender.avatar_url, url: payload.sender.html_url })
        .setDescription(pr.title)
        .addFields(
            { name: 'From', value: `\`${headBranch}\``, inline: true },
            { name: 'To', value: `\`${baseBranch}\``, inline: true }
        )
        .setTimestamp(new Date(pr.updated_at));

    if (pr.body) {
        embed.setDescription(`${pr.title}\n\n${pr.body.substring(0, 500)}${pr.body.length > 500 ? '...' : ''}`);
    }

    sendMessage(client, prConfig.channelId, embed, guildId);
}

/**
 * Processa eventos de issues do GitHub.
 * @param {Client} client O cliente Discord.
 * @param {object} config A configuração do repositório para a guild.
 * @param {object} payload O payload do evento do GitHub.
 * @param {string} guildId O ID da guild.
 */
function handleIssuesEvent(client, config, payload, guildId) {
    const { issues: issuesConfig } = config;
    if (!issuesConfig.enabled) return;

    const { action, issue } = payload;

    // 1. Filtro de Evento
    if (!issuesConfig.eventFilter.includes(action)) return;

    // 2. Filtro de Labels
    const issueLabels = issue.labels.map(label => label.name.toLowerCase());
    const filterLabels = issuesConfig.labelFilter.list.map(l => l.toLowerCase());
    const hasLabelMatch = filterLabels.some(filterLabel => issueLabels.includes(filterLabel));

    if (issuesConfig.labelFilter.mode === 'whitelist' && !hasLabelMatch) return;
    if (issuesConfig.labelFilter.mode === 'blacklist' && hasLabelMatch) return;

    // 3. Construção do Embed
    let embedColor;
    let titleAction;
    switch (action) {
        case 'opened':
        case 'reopened':
            embedColor = '#2da44e'; // Verde
            titleAction = `Issue ${action.charAt(0).toUpperCase() + action.slice(1)} #${issue.number}`;
            break;
        case 'closed':
            embedColor = '#cf222e'; // Vermelho
            titleAction = `Issue Closed #${issue.number}`;
            break;
        default:
            embedColor = client.config.colors.primary || '#000000';
            titleAction = `Issue #${issue.number} ${action}`;
    }

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`[${payload.repository.name}] ${titleAction}`)
        .setURL(issue.html_url)
        .setAuthor({ name: payload.sender.login, iconURL: payload.sender.avatar_url, url: payload.sender.html_url })
        .setTimestamp(new Date(issue.updated_at));

    let description = `**${issue.title}**`;
    if (issue.body) {
        description += `\n\n${issue.body.substring(0, 500)}${issue.body.length > 500 ? '...' : ''}`;
    }
    embed.setDescription(description);

    sendMessage(client, issuesConfig.channelId, embed, guildId);
}

/**
 * Processa eventos de release do GitHub.
 * @param {Client} client O cliente Discord.
 * @param {object} config A configuração do repositório para a guild.
 * @param {object} payload O payload do evento do GitHub.
 * @param {string} guildId O ID da guild.
 */
function handleReleaseEvent(client, config, payload, guildId) {
    const { releases: releaseConfig } = config;
    if (!releaseConfig.enabled || payload.action !== 'published') return;

    const { release } = payload;

    // 1. Filtro de Tipo de Release
    const isPrerelease = release.prerelease;
    if (isPrerelease && !releaseConfig.typeFilter.includes('prerelease')) return;
    if (!isPrerelease && !releaseConfig.typeFilter.includes('published')) return;

    // 2. Construção do Embed
    const embedColor = '#f1e05a'; // Amarelo
    const releaseType = isPrerelease ? 'Pre-release' : 'Release';
    const title = `[${payload.repository.name}] New ${releaseType}: ${release.name || release.tag_name}`;

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(title)
        .setURL(release.html_url)
        .setAuthor({ name: release.author.login, iconURL: release.author.avatar_url, url: release.author.html_url })
        .setTimestamp(new Date(release.published_at));

    let description = `**Tag:** \`${release.tag_name}\``;
    if (release.body) {
        description += `\n\n${release.body.substring(0, 1500)}${release.body.length > 1500 ? '...' : ''}`;
    }
    embed.setDescription(description);

    sendMessage(client, releaseConfig.channelId, embed, guildId);
}

/**
 * Processa eventos de watch (star) do GitHub.
 * @param {Client} client O cliente Discord.
 * @param {object} config A configuração do repositório para a guild.
 * @param {object} payload O payload do evento do GitHub.
 * @param {string} guildId O ID da guild.
 */
function handleStarEvent(client, config, payload, guildId) {
    const { stars: starsConfig } = config;
    if (!starsConfig.enabled || payload.action !== 'started') {
        return;
    }

    const embed = new EmbedBuilder()
        .setColor('#ffac33') // Laranja/Dourado para estrelas
        .setTitle(`[${payload.repository.name}] New Star! ⭐`)
        .setURL(payload.repository.html_url)
        .setAuthor({ name: payload.sender.login, iconURL: payload.sender.avatar_url, url: payload.sender.html_url })
        .setDescription(`The repository now has **${payload.repository.stargazers_count}** stars!`)
        .setTimestamp();

    sendMessage(client, starsConfig.channelId, embed, guildId);
}

/**
 * Processa eventos de fork do GitHub.
 * @param {Client} client O cliente Discord.
 * @param {object} config A configuração do repositório para a guild.
 * @param {object} payload O payload do evento do GitHub.
 * @param {string} guildId O ID da guild.
 */
function handleForkEvent(client, config, payload, guildId) {
    const { forks: forksConfig } = config;
    if (!forksConfig.enabled) {
        return;
    }

    const forkee = payload.forkee;
    const embed = new EmbedBuilder()
        .setColor('#8957e5') // Roxo claro para forks
        .setTitle(`[${payload.repository.name}] Repository Forked!`)
        .setURL(forkee.html_url)
        .setAuthor({ name: payload.sender.login, iconURL: payload.sender.avatar_url, url: payload.sender.html_url })
        .setDescription(`Forked to **[${forkee.full_name}](${forkee.html_url})**. The repository now has **${payload.repository.forks_count}** forks.`)
        .setTimestamp();

    sendMessage(client, forksConfig.channelId, embed, guildId);
}

/**
 * Processa eventos de comentário em issue do GitHub.
 * @param {Client} client O cliente Discord.
 * @param {object} config A configuração do repositório para a guild.
 * @param {object} payload O payload do evento do GitHub.
 * @param {string} guildId O ID da guild.
 */
function handleIssueCommentEvent(client, config, payload, guildId) {
    const { issueComments: commentsConfig } = config;
    if (!commentsConfig.enabled || payload.action !== 'created') {
        return;
    }

    const { issue, comment } = payload;
    const embed = new EmbedBuilder()
        .setColor('#58a6ff') // Azul para comentários
        .setTitle(`[${payload.repository.name}] New Comment on Issue #${issue.number}`)
        .setURL(comment.html_url)
        .setAuthor({ name: comment.user.login, iconURL: comment.user.avatar_url, url: comment.user.html_url })
        .setDescription(`**${issue.title}**\n\n${comment.body.substring(0, 1500)}${comment.body.length > 1500 ? '...' : ''}`)
        .setTimestamp(new Date(comment.created_at));

    sendMessage(client, commentsConfig.channelId, embed, guildId);
}

/**
 * Processa eventos de revisão de pull request do GitHub.
 * @param {Client} client O cliente Discord.
 * @param {object} config A configuração do repositório para a guild.
 * @param {object} payload O payload do evento do GitHub.
 * @param {string} guildId O ID da guild.
 */
function handlePullRequestReviewEvent(client, config, payload, guildId) {
    const { pullRequestReviews: reviewsConfig } = config;
    if (!reviewsConfig.enabled || payload.action !== 'submitted') {
        return;
    }

    const { review, pull_request: pr } = payload;

    let embedColor;
    let stateText;
    switch (review.state) {
        case 'approved':
            embedColor = '#2da44e'; // Verde
            stateText = 'Approved ✅';
            break;
        case 'changes_requested':
            embedColor = '#cf222e'; // Vermelho
            stateText = 'Changes Requested ❌';
            break;
        case 'commented':
            embedColor = '#58a6ff'; // Azul
            stateText = 'Commented 💬';
            break;
        default:
            return; // Ignora outros estados
    }

    const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(`[${payload.repository.name}] PR #${pr.number} Review: ${stateText}`)
        .setURL(review.html_url)
        .setAuthor({ name: review.user.login, iconURL: review.user.avatar_url, url: review.user.html_url })
        .setDescription(`**${pr.title}**\n\n${review.body ? review.body.substring(0, 1500) : '*No comment provided.*'}`)
        .setTimestamp(new Date(review.submitted_at));

    sendMessage(client, reviewsConfig.channelId, embed, guildId);
}

module.exports = {
    handlePushEvent,
    handlePullRequestEvent,
    handleIssuesEvent,
    handleReleaseEvent,
    handleStarEvent,
    handleForkEvent,
    handleIssueCommentEvent,
    handlePullRequestReviewEvent
};