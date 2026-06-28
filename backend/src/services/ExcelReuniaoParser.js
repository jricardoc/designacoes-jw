// Parser da programação da reunião a partir de um Excel (.xlsx).
//
// Esta é a lógica que vivia inline em ReuniaoController.importExcel — foi extraída
// para um serviço (sem mudança de comportamento) para que o controller unificado
// possa reutilizá-la junto do PdfReuniaoParser. Devolve { mes, ano, semanas }.

const xlsx = require('xlsx');

function parseExcel(buffer) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });

    const formatExcelTime = (val) => {
        if (typeof val === 'number' && val > 0 && val < 1) {
            const totalMinutes = Math.round(val * 24 * 60);
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        }
        if (typeof val === 'string') {
            const match = val.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
            if (match) {
                return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
            }
        }
        return null;
    };

    const semanasParaSalvar = [];
    let currentSemana = null;
    let currentSection = 'TESOUROS';

    let globalMes = 0;
    let globalAno = new Date().getFullYear();

    const mesesMap = {
        'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3, 'abril': 4, 'maio': 5, 'junho': 6,
        'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
    };

    for (let i = 0; i < data.length; i++) {
        const row = data[i];

        const isValidaData = (str) => {
            if (typeof str !== 'string') return false;
            let s = str.trim().toLowerCase();
            if (s.length > 50) return false;
            const months = ['janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
            const hasMonth = months.some(m => s.includes(m));
            const hasDateRange = /\d{1,2}\s*(?:-|a|à)\s*\d{1,2}/.test(s);
            return hasMonth && hasDateRange;
        };

        const possivelData = row.find(c => isValidaData(c));

        if (possivelData) {
            if (currentSemana && currentSemana.faixaData) {
                semanasParaSalvar.push(currentSemana);
            }

            currentSemana = {
                faixaData: possivelData.replace(/\s+/g, ' ').trim(),
                dataReuniao: null,
                leituraSemanal: null
            };
            currentSection = 'TESOUROS';

            if (globalMes === 0) {
                const mesNome = possivelData.split(' ')[0].toLowerCase().trim();
                globalMes = mesesMap[mesNome] || 1;
            }
            continue;
        }

        if (!currentSemana) continue;

        const nonNulls = row.filter(c => c !== null && c !== undefined && c !== '');

        if (nonNulls.some(c => typeof c === 'string' && c.trim().toUpperCase() === 'TESOUROS DA PALAVRA DE DEUS')) {
            currentSection = 'TESOUROS';
        } else if (nonNulls.some(c => typeof c === 'string' && c.trim().toUpperCase() === 'FAÇA SEU MELHOR NO MINISTÉRIO')) {
            currentSection = 'MINISTERIO';
        } else if (nonNulls.some(c => typeof c === 'string' && c.trim().toUpperCase() === 'NOSSA VIDA CRISTÃ')) {
            currentSection = 'VIDA_CRISTA';
        }

        if (nonNulls.some(c => typeof c === 'string' && c.trim().toUpperCase() === 'TESOUROS DA PALAVRA DE DEUS')) {
            currentSection = 'TESOUROS';
        } else if (nonNulls.some(c => typeof c === 'string' && c.trim().toUpperCase() === 'FAÇA SEU MELHOR NO MINISTÉRIO')) {
            currentSection = 'MINISTERIO';
        } else if (nonNulls.some(c => typeof c === 'string' && c.trim().toUpperCase() === 'NOSSA VIDA CRISTÃ')) {
            currentSection = 'VIDA_CRISTA';
        }

        const linhaDataLeitura = nonNulls.find(c => typeof c === 'string' && c.includes('|') && /\d{2}\/\d{2}\/\d{4}/.test(c));
        if (linhaDataLeitura) {
            const parts = linhaDataLeitura.split('|');
            currentSemana.dataReuniao = parts[0].trim();
            currentSemana.leituraSemanal = parts[1] ? parts[1].trim() : null;
        }

        // Busca Key-Value Dinâmica
        const findValueForLabel = (labels) => {
            const idx = row.findIndex(c => typeof c === 'string' && labels.some(l => c.toLowerCase().includes(l.toLowerCase())));
            if (idx !== -1) {
                for (let j = idx + 1; j < row.length; j++) {
                    if (row[j] && String(row[j]).trim() !== '') return String(row[j]).trim();
                }
            }
            if (idx !== -1 && i + 1 < data.length) {
                const nextRowVal = data[i + 1][idx];
                if (nextRowVal && String(nextRowVal).trim() !== '') return String(nextRowVal).trim();
                const nextRowNonNulls = data[i + 1].filter(c => !!c);
                if (nextRowNonNulls.length > 0) return String(nextRowNonNulls[0]).trim();
            }
            return null;
        };

        const extPres = findValueForLabel(['Presidente:']);
        if (extPres) {
            if (!currentSemana.presidente) {
                currentSemana.presidente = extPres;
            } else if (currentSemana.presidente !== extPres && !currentSemana.fds_presidente) {
                currentSemana.fds_presidente = extPres;
            }
        }

        const extOracaoInc = findValueForLabel(['Oração Inicial:', 'Oração:']);
        if (extOracaoInc && !currentSemana.oracaoInicial && !row.some(c => typeof c === 'string' && c.toLowerCase().includes('final'))) {
            currentSemana.oracaoInicial = extOracaoInc;
        }

        const conselheiroB = findValueForLabel(['Conselheiro:', 'Sala B:']);
        if (conselheiroB && !conselheiroB.includes('Sala B') && !currentSemana.conselheiroB) {
            currentSemana.conselheiroB = conselheiroB;
        }

        const extOracaoFim = findValueForLabel(['Oração Final:', 'Oração:']);
        if (extOracaoFim && !row.some(c => typeof c === 'string' && c.includes('Oração Inicial'))) {
            currentSemana.oracaoFinal = extOracaoFim;
        }

        const extLimpeza = findValueForLabel(['Limpeza:', 'limpeza:', 'Limpeza Semanal']);
        if (extLimpeza) {
            currentSemana.limpeza = extLimpeza;
        }

        const titleField = nonNulls.find(c => typeof c === 'string' && /^\d+\.\s/.test(c.trim()));
        if (titleField) {
            let titleStr = titleField.trim();
            titleStr = titleStr.replace(/^(\d+\.\s)(?:\d+\.\s)+/, "$1");

            const timeCell = row.find(c =>
                (typeof c === 'number' && c > 0 && c < 1) ||
                (typeof c === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(c.trim()))
            );
            const timeStr = timeCell ? formatExcelTime(timeCell) : null;
            if (timeStr) {
                titleStr = `${timeStr} ${titleStr}`;
            }

            const partNumberMatch = titleStr.match(/(\d+)\.\s/);
            if (partNumberMatch) {
                const titleIdx = nonNulls.indexOf(titleField);

                const names = nonNulls.slice(titleIdx + 1)
                    .map(n => String(n).trim())
                    .filter(n => !n.endsWith(':') && n.toLowerCase() !== 'sala b' && n.toLowerCase() !== 'salão principal');

                let principal = null;
                let salaB = null;

                if (names.length >= 2) {
                    salaB = names[names.length - 2];
                    principal = names[names.length - 1];
                } else if (names.length === 1) {
                    principal = names[0];
                }

                if (currentSection === 'TESOUROS') {
                    if (!currentSemana.tesouro1_titulo) {
                        currentSemana.tesouro1_titulo = titleStr;
                        currentSemana.tesouro1_irmao = principal || salaB;
                    } else if (!currentSemana.tesouro2_titulo) {
                        currentSemana.tesouro2_titulo = titleStr;
                        currentSemana.tesouro2_irmao = principal || salaB;
                    } else {
                        currentSemana.tesouro3_titulo = titleStr;
                        currentSemana.tesouro3_principal = principal;
                        currentSemana.tesouro3_salaB = salaB;
                    }
                } else if (currentSection === 'MINISTERIO') {
                    if (!currentSemana.ministerio1_titulo) {
                        currentSemana.ministerio1_titulo = titleStr;
                        currentSemana.ministerio1_principal = principal;
                        currentSemana.ministerio1_salaB = salaB;
                    } else if (!currentSemana.ministerio2_titulo) {
                        currentSemana.ministerio2_titulo = titleStr;
                        currentSemana.ministerio2_principal = principal;
                        currentSemana.ministerio2_salaB = salaB;
                    } else if (!currentSemana.ministerio3_titulo) {
                        currentSemana.ministerio3_titulo = titleStr;
                        currentSemana.ministerio3_principal = principal;
                        currentSemana.ministerio3_salaB = salaB;
                    } else {
                        currentSemana.ministerio4_titulo = titleStr;
                        currentSemana.ministerio4_principal = principal;
                        currentSemana.ministerio4_salaB = salaB;
                    }
                } else if (currentSection === 'VIDA_CRISTA') {
                    if (titleStr.toLowerCase().includes('estudo') || titleStr.toLowerCase().includes('congregação')) {
                        let irmaoA = principal || salaB || '';
                        let partesIrmaos = irmaoA.split('/');
                        currentSemana.estudoBiblico_dirigente = partesIrmaos[0] ? partesIrmaos[0].trim() : null;
                        currentSemana.estudoBiblico_leitor = partesIrmaos[1] ? partesIrmaos[1].trim() : null;
                    } else if (!currentSemana.vidaCrista1_titulo) {
                        currentSemana.vidaCrista1_titulo = titleStr;
                        currentSemana.vidaCrista1_irmao = principal || salaB;
                    } else if (!currentSemana.vidaCrista2_titulo && titleStr !== currentSemana.vidaCrista1_titulo) {
                        currentSemana.vidaCrista2_titulo = titleStr;
                        currentSemana.vidaCrista2_irmao = principal || salaB;
                    }
                }
            }
        }

        const canticoCellIdx = nonNulls.findIndex(c => typeof c === 'string' && /^c[âa]ntico/i.test(c.trim()));
        if (canticoCellIdx !== -1) {
            const canticoStr = nonNulls[canticoCellIdx].trim();
            let num = null;
            const match = canticoStr.match(/^c[âa]ntico\s+(\d+)/i);
            if (match) {
                num = match[1];
            } else {
                num = nonNulls[canticoCellIdx + 1];
            }
            if (num && !isNaN(parseInt(num, 10))) {
                const timeCell = row.find(c =>
                    (typeof c === 'number' && c > 0 && c < 1) ||
                    (typeof c === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(c.trim()))
                );
                const timeStr = timeCell ? formatExcelTime(timeCell) : null;
                const finalVal = timeStr ? `${timeStr}|${String(num).trim()}` : String(num).trim();

                if (!currentSemana.canticoInicial) {
                    currentSemana.canticoInicial = finalVal;
                } else if (!currentSemana.canticoMeio) {
                    currentSemana.canticoMeio = finalVal;
                } else {
                    currentSemana.canticoFinal = finalVal;
                }
            }
        }

        const temaFds = findValueForLabel(['Tema:']);
        if (temaFds) currentSemana.fds_tema = temaFds;

        const oradorFds = findValueForLabel(['Orador:']);
        if (oradorFds) currentSemana.fds_orador = oradorFds;

        const leitorFds = findValueForLabel(['Leitor da Sentinela:', 'Sentinela:', 'Leitor da\nSentinela:']);
        if (leitorFds && !currentSemana.fds_leitor) {
            currentSemana.fds_leitor = leitorFds;
        }
    }

    if (currentSemana && currentSemana.faixaData) {
        semanasParaSalvar.push(currentSemana);
    }

    return { mes: globalMes, ano: globalAno, semanas: semanasParaSalvar };
}

module.exports = { parseExcel };
