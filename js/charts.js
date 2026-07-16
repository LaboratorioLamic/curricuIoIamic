// ===== Base de gráficos (Chart.js) compartilhada por Dashboard, Folha e Resultados =====
//
// Antes cada página tinha sua própria paleta, suas opções de Chart.js e seu array de
// instâncias para destruir. Isso vive aqui para que um gráfico signifique a mesma coisa
// em qualquer tela — e para que ninguém esqueça o destroy() e vaze canvas ao trocar de aba.

// Paleta categórica validada (dataviz) — ordem fixa, nunca ciclada
const DV = {
    s1: '#2a78d6', // azul
    s2: '#1baf7a', // verde-água
    s3: '#eda100', // amarelo
    s4: '#008300', // verde
    s5: '#4a3aa7', // violeta
    s6: '#e34948', // vermelho
    s7: '#e87ba4', // magenta
    s8: '#eb6834', // laranja
    grid: '#e9eaf2',
    ink: '#8a90a3'
};
const DV_SLOTS = [DV.s1, DV.s2, DV.s3, DV.s4, DV.s5, DV.s6, DV.s7, DV.s8];
const dvCor = i => DV_SLOTS[i % DV_SLOTS.length];

// ---- Registro de instâncias por "dono" (página) ----
// Chart.js não solta o canvas sozinho: sem destroy() o gráfico antigo continua vivo,
// respondendo a hover e segurando memória, e o novo desenha por cima.
const _chartReg = {};
function chartRegister(dono, chart) {
    (_chartReg[dono] = _chartReg[dono] || []).push(chart);
    return chart;
}
function chartDestroy(dono) {
    (_chartReg[dono] || []).forEach(c => { try { c.destroy(); } catch {} });
    _chartReg[dono] = [];
}

// Destrói só o gráfico de um canvas (para redesenhar um card sem recriar a aba toda).
function chartDestroyOne(dono, id) {
    const reg = _chartReg[dono] || [];
    for (let i = reg.length - 1; i >= 0; i--) {
        if (reg[i].canvas && reg[i].canvas.id === id) { try { reg[i].destroy(); } catch {} reg.splice(i, 1); }
    }
}

// Cria um gráfico no canvas `id`. Silencioso se o canvas não existir (aba trocou no meio).
// Destrói qualquer instância prévia NESSE canvas primeiro — sem isso, redesenhar um card
// (ex.: ranking reagindo à legenda do empilhado) empilha instâncias mortas: a antiga
// continua presa ao canvas e o Chart.js recusa ou ignora a nova.
function mkChart(dono, id, cfg) {
    const el = document.getElementById(id);
    if (!el) return null;
    chartDestroyOne(dono, id);
    const existente = Chart.getChart(el);
    if (existente) existente.destroy();
    return chartRegister(dono, new Chart(el, cfg));
}

// ---- Formatação de eixo/tooltip por tipo de dado ----
// 'hhmm' (banco de horas) é o único caso em que eixo e tooltip divergem de propósito: os
// ticks do Chart.js não caem em múltiplos sexagesimais redondos, então "12,5 h" no eixo é
// legível e "12:30" não é. No tooltip vale o inverso — ali a precisão é o ponto.
const dvTickFmt = {
    brl: v => 'R$ ' + Number(v).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }),
    pct: v => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
    num: v => Number(v).toLocaleString('pt-BR'),
    dec: v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
    hhmm: v => fmtHorasDec(v)
};
const dvValorFmt = (v, fmt) =>
    fmt === 'brl' ? fmtBRL(v)
    : fmt === 'pct' ? fmtPct(v)
    : fmt === 'hhmm' ? fmtHHMM(v)
    : fmt === 'dec' ? Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
    : fmtNum(Math.round(Number(v) || 0));

// Opções base. `fmt` controla eixo Y e tooltip; `empilhado` liga o stack nos dois eixos.
//
// `tooltipExtra` acrescenta callbacks (ex.: footer com o total do mês) SEM derrubar o
// label padrão — espalhar um `plugins.tooltip` inteiro por cima substituiria o objeto
// e levaria junto a formatação por `fmt`.
function dvOpts({ fmt = 'num', legenda = false, empilhado = false, onClick = null, tooltipExtra = {}, extras = {} } = {}) {
    const { callbacks: cbExtra, ...tipExtra } = tooltipExtra;
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        onClick,
        plugins: {
            legend: {
                display: legenda, position: 'bottom',
                labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } }
            },
            tooltip: {
                padding: 10, backgroundColor: '#23233f', cornerRadius: 8,
                callbacks: {
                    label: ctx => `${ctx.dataset.label}: ${dvValorFmt(ctx.parsed.y, fmt)}`,
                    ...cbExtra
                },
                ...tipExtra
            },
            ...extras.plugins
        },
        scales: {
            x: { stacked: empilhado, grid: { display: false }, ticks: { color: DV.ink, font: { size: 10 } } },
            y: {
                stacked: empilhado, beginAtZero: true, grid: { color: DV.grid }, border: { display: false },
                // Contagem de pessoas/eventos é inteira: sem isso o Chart.js inventa
                // ticks "0,2 / 0,4" em séries pequenas — meia pessoa não existe.
                ticks: {
                    color: DV.ink, font: { size: 10 },
                    precision: fmt === 'num' ? 0 : undefined,
                    callback: dvTickFmt[fmt] || dvTickFmt.num
                }
            },
            ...extras.scales
        }
    };
}

// Linha de média tracejada sobreposta às barras (art. visual: sempre atrás das barras).
const dvLinhaMedia = (media, n = 12) => ({
    type: 'line', label: 'Média', data: Array(n).fill(media),
    borderColor: DV.s6, borderWidth: 1.5, borderDash: [5, 4],
    pointRadius: 0, pointHitRadius: 0, tension: 0, order: 1
});

const dvBarra = (label, vals, cor, extra = {}) => ({
    label, data: vals,
    backgroundColor: cor + 'cc', hoverBackgroundColor: cor,
    borderRadius: 5, maxBarThickness: 34, order: 2,
    ...extra
});

// Explica um gráfico num modal (não popover: o pedido foi por algo "bonito e atrativo",
// que cabe descrição longa — um popover de 220px não cabe um parágrafo confortável).
// `info`: string (vira "o que mostra") ou {oQue, objetivo, leitura}.
function openChartInfo(titulo, info) {
    const o = typeof info === 'string' ? { oQue: info } : (info || {});
    openModal({
        title: titulo,
        size: 'modal-sm modal-chart-info',
        body: `
            <div class="chart-info-body">
                ${o.oQue ? `<div class="chart-info-sec"><span class="chart-info-ico">${icon('info')}</span><div><strong>O que este gráfico mostra</strong><p>${o.oQue}</p></div></div>` : ''}
                ${o.objetivo ? `<div class="chart-info-sec"><span class="chart-info-ico">${icon('launch')}</span><div><strong>Objetivo</strong><p>${o.objetivo}</p></div></div>` : ''}
                ${o.leitura ? `<div class="chart-info-sec"><span class="chart-info-ico">${icon('chart')}</span><div><strong>Como ler</strong><p>${o.leitura}</p></div></div>` : ''}
            </div>`,
        footer: ''
    });
}

// Mapa id→info dos cards vivos, para a delegação global abaixo achar o conteúdo certo
// sem precisar religar um onclick por card a cada redesenho.
const _chartInfoReg = {};

document.addEventListener('click', e => {
    const btn = e.target.closest('.chart-info-btn');
    if (!btn) return;
    const entry = _chartInfoReg[btn.dataset.infoId];
    if (entry) openChartInfo(entry.titulo, entry.info);
});

// Card de gráfico com total/média no cabeçalho. `stats` já vem formatado pelo chamador.
// `acao` injeta HTML no canto do cabeçalho (ex.: o botão "Legenda" do empilhado).
// `info` liga o botão "i": string ou {oQue, objetivo, leitura} — ver openChartInfo.
function chartCard({ id, titulo, total, media, sub, acao, info }) {
    if (info) _chartInfoReg[id] = { titulo, info };
    return `
        <div class="chart-card">
            <div class="chart-card-head">
                <div>
                    <div class="chart-card-title">${titulo}${info ? `<button class="chart-info-btn" data-info-id="${id}" title="O que é este gráfico?">${icon('info')}</button>` : ''}</div>
                    ${sub ? `<div class="chart-card-sub">${sub}</div>` : ''}
                </div>
                ${acao ? `<div class="chart-card-acao">${acao}</div>` : ''}
                ${total != null || media != null ? `
                <div class="chart-card-stats">
                    ${total != null ? `<span class="cc-total">${total}</span>` : ''}
                    ${media != null ? `<span class="cc-media">${media}</span>` : ''}
                </div>` : ''}
            </div>
            <div class="chart-box"><canvas id="${id}"></canvas></div>
        </div>`;
}

// Barras HORIZONTAIS ordenadas do maior para o menor, com quantidade e % no rótulo/tooltip.
// `linhas`: [{label, vals[12]}] — soma o ano de cada uma e rankeia.
// `visiveis`: Set opcional de índices (como string) de `linhas` a considerar — usado para
// o ranking acompanhar a mesma seleção da legenda do empilhado ao lado.
function pintarRankingHorizontal(dono, id, linhas, fmt = 'num', visiveis = null) {
    const itens = linhas
        .map((li, i) => ({ label: li.label, val: li.vals.reduce((a, b) => a + b, 0), cor: dvCor(i), i }))
        .filter(it => it.val > 0 && (!visiveis || visiveis.has(String(it.i))))
        .sort((a, b) => b.val - a.val);
    const total = itens.reduce((s, it) => s + it.val, 0);

    return mkChart(dono, id, {
        type: 'bar',
        data: {
            labels: itens.map(it => it.label),
            datasets: [{
                data: itens.map(it => it.val),
                backgroundColor: itens.map(it => it.cor + 'cc'),
                hoverBackgroundColor: itens.map(it => it.cor),
                borderRadius: 5, maxBarThickness: 30
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 10, backgroundColor: '#23233f', cornerRadius: 8,
                    callbacks: {
                        label: ctx => `${dvValorFmt(ctx.parsed.x, fmt)}` + (total ? ` · ${dvValorFmt(ctx.parsed.x / total * 100, 'pct')}` : '')
                    }
                }
            },
            scales: {
                x: { beginAtZero: true, grid: { color: DV.grid }, border: { display: false }, ticks: { color: DV.ink, font: { size: 10 }, precision: fmt === 'num' ? 0 : undefined, callback: dvTickFmt[fmt] || dvTickFmt.num } },
                y: { grid: { display: false }, ticks: { color: DV.ink, font: { size: 11 }, autoSkip: false } }
            }
        }
    });
}
