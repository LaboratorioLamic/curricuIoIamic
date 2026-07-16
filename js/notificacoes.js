// ===== Sino de notificações: equipe incompleta + cobertura reduzida =====
//
// Antes esses alertas eram cards fixos no topo do Dashboard — competiam por espaço
// com os KPIs e empurravam os gráficos para baixo quando havia várias unidades em
// alerta. Agora vivem no sino do topbar: contagem no badge, detalhe completo no clique.
// O cálculo (diagnosticoUnidade/diagnosticoCobertura) não mudou, só o container visual.

const notifState = { alertas: [], coberturas: [], asos: [], bancos: [], decimos: [], cargos: [] };

// Chamado pelo Dashboard (reaproveita o payload já buscado) ou, na ausência de um,
// busca o mínimo necessário sozinho — assim o sino funciona mesmo antes de entrar no Dashboard.
async function refreshNotificacoes(dadosOpt) {
    const dados = dadosOpt || await (async () => {
        const [funcionarios, unidades, ausencias, cargos] = await Promise.all([
            DB.getAll(PATHS.funcionarios), DB.getAll(PATHS.unidades), DB.getAll(PATHS.ausencias), DB.getAll(PATHS.cargos)
        ]);
        return { funcionarios, unidades, ausencias, cargos };
    })();

    // ASOs e banco de horas não vêm no payload do Dashboard (que não usa esses dados) —
    // busca só o que faltar.
    const asos = dados.asos || await DB.getAll(PATHS.asos);
    const [banco, bhFechs, bhQuits] = dados.banco
        ? [dados.banco, dados.bhFechamentos || [], dados.bhQuitacoes || []]
        : await Promise.all([DB.getObj(PATHS.bancoHoras), DB.getAll(PATHS.bancoHorasFechamentos), DB.getAll(PATHS.bancoHorasQuitacoes)]);

    notifState.alertas = dados.unidades.map(u => diagnosticoUnidade(u, dados.funcionarios)).filter(Boolean);
    notifState.coberturas = dados.unidades.map(u => diagnosticoCobertura(u, dados.funcionarios, dados.ausencias)).filter(Boolean);
    notifState.asos = dados.unidades.map(u => diagnosticoAso(u, dados.funcionarios, asos, dados.cargos)).filter(Boolean);
    notifState.bancos = dados.unidades.map(u => diagnosticoBh(u, dados.funcionarios, banco || {}, bhFechs, null, bhQuits)).filter(Boolean);

    // 13º: prazo legal com multa administrativa (Lei 4.749 art. 2º). O contexto lê as mesmas
    // fontes da aba — inclusive o adiantamento pago nas férias, senão quem já adiantou seria
    // cobrado de novo pelo sino.
    const [decimos, cargos13, params13] = await Promise.all([
        dados.decimos ? Promise.resolve(dados.decimos) : DB.getAll(PATHS.decimos),
        Promise.resolve(dados.cargos || []),
        dados.params ? Promise.resolve(dados.params) : DB.getObj(PATHS.parametros)
    ]);
    const ctx13 = {
        funcionarios: dados.funcionarios, cargos: cargos13, ausencias: dados.ausencias,
        demissoes: dados.demissoes || await DB.getAll(PATHS.demissoes),
        decimos, params: params13 || {},
        // A média de HE exige as fontes do banco; o sino não as tem sempre. Sem ela o valor
        // sai um pouco menor — aceitável aqui: o sino alerta sobre PRAZO, e o valor exato
        // está na aba. Nunca o contrário: um sino que não abre é pior que um valor redondo.
        mediaHe13: () => 0
    };
    notifState.decimos = dados.unidades.map(u => diagnosticoDecimo(u, dados.funcionarios, ctx13)).filter(Boolean);
    notifState.cargos = dados.cargos || [];
    renderBellIcon();
}

function renderBellIcon() {
    const box = document.getElementById('topbarActions');
    if (!box) return;
    const total = notifState.alertas.length + notifState.coberturas.length + notifState.asos.length
        + notifState.bancos.length + notifState.decimos.length;

    let btn = box.querySelector('#btnSino');
    if (!btn) {
        btn = document.createElement('button');
        btn.className = 'bell-btn';
        btn.id = 'btnSino';
        btn.title = 'Notificações';
        btn.onclick = abrirNotificacoes;
        box.insertBefore(btn, box.firstChild);
    }
    btn.innerHTML = `${icon('bell')}${total ? `<span class="bell-badge">${total > 9 ? '9+' : total}</span>` : ''}`;
    btn.classList.toggle('has-alert', total > 0);
}

// Lista simples: uma linha por notificação (unidade + resumo curto). O detalhe completo
// só aparece no clique — a lista em si precisa ser lida de relance, não estudada.
function abrirNotificacoes() {
    closePopover();
    const { alertas, coberturas, asos, bancos, decimos } = notifState;
    const btn = document.getElementById('btnSino');
    if (!btn) return;

    // Ordem = custo de ignorar. ASO vencido é autuação e afastamento imediato; 13º e banco de
    // horas vencidos são dinheiro devido com data legal; quadro incompleto é problema de
    // operação. O 13º entra logo após o ASO nos meses de prazo: ao contrário do banco, a data
    // é a mesma para a empresa inteira, e perdê-la é multa administrativa de uma vez só.
    const linhas = [
        ...asos.map(a => ({ tipo: 'aso', item: a,
            resumo: [
                a.vencidos ? `${a.vencidos} vencido(s)` : '',
                a.semHistorico ? `${a.semHistorico} sem ASO` : '',
                a.criticos ? `${a.criticos} vencendo` : ''
            ].filter(Boolean).join(' · ') })),
        ...decimos.map(d => ({ tipo: 'decimo', item: d,
            resumo: [
                d.vencidos ? `${d.vencidos} parcela(s) vencida(s)` : '',
                d.rescisoes ? `${d.rescisoes} rescisão(ões) a pagar` : '',
                d.criticos ? `${d.criticos} a vencer` : ''
            ].filter(Boolean).join(' · ') })),
        ...bancos.map(b => ({ tipo: 'banco', item: b,
            resumo: [
                b.vencidos ? `${b.vencidos} ciclo(s) vencido(s)` : '',
                b.criticos ? `${b.criticos} fechando` : '',
                b.atencao ? `${b.atencao} com saldo alto` : ''
            ].filter(Boolean).join(' · ') })),
        ...alertas.map(a => ({ tipo: 'alerta', item: a,
            resumo: a.modo === 'cargo' ? `${a.cargos.length} cargo(s) abaixo do quadro` : `Faltam ${a.faltam}` })),
        ...coberturas.map(c => ({ tipo: 'cobertura', item: c,
            resumo: `${c.retornos.length} em férias · ${c.cargos.reduce((s, x) => s + x.gap, 0)} vaga(s) descoberta(s)` }))
    ];

    const pop = document.createElement('div');
    pop.className = 'popover pop-notif';
    pop.innerHTML = !linhas.length
        ? `<div class="pop-notif-empty">${icon('check')}<span>Tudo em dia</span></div>`
        : `<div class="pop-list" data-pop-list>${linhas.map((l, i) => `
            <div class="pop-item pop-notif-row" data-i="${i}">
                <span class="alert-ico-sm${l.tipo === 'cobertura' ? ' alert-ico-sm-ferias' : ''}${l.tipo === 'aso' ? ' alert-ico-sm-aso' : ''}${l.tipo === 'banco' ? ' alert-ico-sm-bh' : ''}${l.tipo === 'decimo' ? ' alert-ico-sm-decimo' : ''}">${icon(l.tipo === 'cobertura' ? 'sun' : l.tipo === 'aso' ? 'medical' : l.tipo === 'banco' ? 'clock' : l.tipo === 'decimo' ? 'gift' : 'alert')}</span>
                <div class="grow">
                    <strong>${escapeHtml(l.item.nome)}</strong>
                    <div class="muted">${escapeHtml(l.resumo)}</div>
                </div>
                ${icon('chevronRight')}
            </div>`).join('')}</div>`;
    document.body.appendChild(pop);

    pop.querySelectorAll('[data-i]').forEach(el => el.onclick = () => {
        closePopover();
        abrirDetalheNotificacao(linhas[Number(el.dataset.i)]);
    });

    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = r.right - pw, y = r.bottom + 6;
    if (x < 8) x = r.left;
    if (y + ph > window.innerHeight - 8) y = r.top - ph - 6;
    pop.style.left = `${Math.max(8, x)}px`;
    pop.style.top = `${Math.max(8, y)}px`;
    _popover = pop;
    setTimeout(() => {
        document.addEventListener('mousedown', function h(e) {
            if (_popover && !_popover.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                closePopover(); document.removeEventListener('mousedown', h);
            }
        });
    });
}

// Janela com todas as informações da notificação selecionada
function abrirDetalheNotificacao({ tipo, item }) {
    const cargoNome = id => notifState.cargos.find(c => c.id === id)?.nome || 'cargo';

    // ASO: lista por pessoa (o alerta é individual, não do quadro da unidade). Sem resultado
    // clínico — o sino é sobre prazo vencido, e prazo não é dado de saúde.
    if (tipo === 'aso') {
        const linhaPessoa = p => `
            <div class="aso-notif-row">
                <span class="prog-dot ${ASO_STATUS[p.status].dot}"></span>
                <span class="grow">${escapeHtml(p.nome)}</span>
                <span class="badge ${ASO_STATUS[p.status].cls}">${escapeHtml(p.label)}</span>
            </div>`;
        return openModal({
            title: 'ASO — exames pendentes',
            size: '',
            body: `
                <div class="alert-card alert-aso">
                    <span class="alert-ico">${icon('medical')}</span>
                    <div class="grow">
                        <strong>Exame ocupacional vencido ou próximo do vencimento</strong>
                        <div class="alert-sub">Colaborador sem ASO válido não pode exercer a função (NR-7). Vencidos e "sem ASO" exigem ação imediata.</div>
                        <div class="alert-list">
                            <div class="alert-row">
                                <span class="alert-uni">${icon('building')} ${escapeHtml(item.nome)}</span>
                            </div>
                            <div class="aso-notif-lista">${item.pessoas.map(linhaPessoa).join('')}</div>
                        </div>
                    </div>
                </div>`,
            footer: ''
        });
    }

    // 13º: individual e sobre prazo, como ASO e banco. Mostra o valor porque é ele que
    // dimensiona a urgência — e porque a multa por atraso não depende do valor devido.
    if (tipo === 'decimo') {
        const linhaPessoa = p => `
            <div class="aso-notif-row">
                <span class="prog-dot ${DECIMO_STATUS[p.status].dot}"></span>
                <span class="grow">${escapeHtml(p.nome)}</span>
                <span class="num" style="font-variant-numeric:tabular-nums;margin-right:8px">${fmtBRL(p.valor)}</span>
                <span class="badge ${DECIMO_STATUS[p.status].cls}">${escapeHtml(p.label)}</span>
            </div>`;
        return openModal({
            title: '13º salário — parcelas a pagar',
            size: '',
            body: `
                <div class="alert-card alert-decimo">
                    <span class="alert-ico">${icon('gift')}</span>
                    <div class="grow">
                        <strong>Parcelas do 13º vencidas ou próximas do prazo</strong>
                        <div class="alert-sub">A 1ª parcela vence em 30/11 e a 2ª em 20/12 (Lei 4.749 art. 2º). Atraso é multa administrativa por empregado. Quem já recebeu o adiantamento junto das férias não aparece aqui — ele já teve a 1ª parcela.</div>
                        <div class="alert-list">
                            <div class="alert-row">
                                <span class="alert-uni">${icon('building')} ${escapeHtml(item.nome)}</span>
                                <span class="alert-detail"><span class="alert-gap">total <b>${fmtBRL(item.total)}</b></span></span>
                            </div>
                            <div class="aso-notif-lista">${item.pessoas.map(linhaPessoa).join('')}</div>
                        </div>
                    </div>
                </div>`,
            footer: ''
        });
    }

    // Banco de horas: também individual, e também sobre prazo — mas aqui o prazo tem preço.
    // Mostra o saldo porque é ele que dimensiona o problema: 2 ciclos vencidos com 00:30
    // não é a mesma conversa que 2 vencidos com 40:00.
    if (tipo === 'banco') {
        const linhaPessoa = p => `
            <div class="aso-notif-row">
                <span class="prog-dot ${BH_STATUS[p.status].dot}"></span>
                <span class="grow">${escapeHtml(p.nome)}</span>
                <span class="num" style="font-variant-numeric:tabular-nums;margin-right:8px">${fmtHHMM(p.saldoMin)}</span>
                <span class="badge ${BH_STATUS[p.status].cls}">${escapeHtml(p.label)}</span>
            </div>`;
        return openModal({
            title: 'Banco de horas — ciclos a resolver',
            size: '',
            body: `
                <div class="alert-card alert-bh">
                    <span class="alert-ico">${icon('clock')}</span>
                    <div class="grow">
                        <strong>Ciclos de compensação vencidos ou próximos do fim</strong>
                        <div class="alert-sub">Saldo positivo não compensado dentro do ciclo é devido como hora extra com adicional (CLT art. 59, §2º). Depois do fechamento, deixa de ser folga e vira folha.</div>
                        <div class="alert-list">
                            <div class="alert-row">
                                <span class="alert-uni">${icon('building')} ${escapeHtml(item.nome)}</span>
                            </div>
                            <div class="aso-notif-lista">${item.pessoas.map(linhaPessoa).join('')}</div>
                        </div>
                    </div>
                </div>`,
            footer: ''
        });
    }

    const corpo = tipo === 'alerta' ? `
        <div class="alert-card">
            <span class="alert-ico">${icon('alert')}</span>
            <div class="grow">
                <strong>Equipe incompleta</strong>
                <div class="alert-list">
                    <div class="alert-row">
                        <span class="alert-uni">${icon('building')} ${escapeHtml(item.nome)}</span>
                        ${item.modo === 'cargo'
                            ? `<span class="alert-detail">${item.cargos.map(c => `<span class="alert-gap">${escapeHtml(cargoNome(c.cargoId))}: ${c.ativos}/${c.meta} <b>−${c.faltam}</b></span>`).join('')}</span>`
                            : `<span class="alert-detail"><span class="alert-gap">${item.ativos}/${item.meta} <b>faltam ${item.faltam}</b></span></span>`}
                    </div>
                </div>
            </div>
        </div>` : `
        <div class="alert-card alert-cobertura">
            <span class="alert-ico">${icon('sun')}</span>
            <div class="grow">
                <strong>Cobertura reduzida — férias em curso</strong>
                <div class="alert-sub">Quadro contratado está completo; a ausência é temporária. Avalie escala ou substituição, não contratação.</div>
                <div class="alert-list">
                    <div class="alert-row">
                        <span class="alert-uni">${icon('building')} ${escapeHtml(item.nome)}</span>
                        <span class="alert-detail">${item.cargos.map(x => `<span class="alert-gap">${escapeHtml(cargoNome(x.cargoId))}: ${x.presentes}/${x.meta} presentes <b>−${x.gap}</b></span>`).join('')}</span>
                    </div>
                    <div class="alert-retornos">${item.retornos.map(r => `<span>${escapeHtml(r.nome)} volta ${fmtDate(r.a.retorno)}</span>`).join('')}</div>
                </div>
            </div>
        </div>`;

    openModal({ title: tipo === 'alerta' ? 'Equipe incompleta' : 'Cobertura reduzida', size: '', body: corpo, footer: '' });
}
