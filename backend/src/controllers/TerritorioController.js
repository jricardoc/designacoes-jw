const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Cartoes de mapa de territorio.
 *
 * Os cartoes NAO vivem no banco: sao imagens estaticas geradas a partir dos
 * PDFs oficiais pelo script territorio/extrair.py (na raiz do repositorio),
 * que escreve as imagens e o manifesto em backend/public/territorios/.
 * Atualizar os cartoes = rodar o script de novo + deploy. Sem tabela, sem
 * upload: o arquivo de territorios muda poucas vezes por ano.
 */

const PASTA = path.join(__dirname, '..', '..', 'public', 'territorios');
const MANIFESTO = path.join(PASTA, 'territorios.json');
const BASE_ARQUIVOS = '/territorios/arquivos';

// Lido uma vez por processo: o manifesto so muda com deploy, que reinicia tudo.
let manifesto = null;
let versoes = null;

function carregarManifesto() {
    if (!manifesto) {
        manifesto = JSON.parse(fs.readFileSync(MANIFESTO, 'utf-8'));
        // Versao por CONTEUDO de cada imagem, anexada a URL como ?v=. Sem isso
        // um cartao re-extraido (mesmo nome de arquivo) nunca chega a quem ja o
        // viu: o cache de imagem do Android (Fresco) indexa por URI e nao
        // revalida — o mapa antigo ficaria na tela para sempre.
        versoes = {};
        for (const t of manifesto.territorios) {
            for (const arq of Object.values(t.arquivos)) {
                if (!arq || versoes[arq]) continue;
                const bytes = fs.readFileSync(path.join(PASTA, arq));
                versoes[arq] = crypto.createHash('md5').update(bytes).digest('hex').slice(0, 8);
            }
        }
    }
    return manifesto;
}

function urlArquivo(arq) {
    return arq ? `${BASE_ARQUIVOS}/${arq}?v=${versoes[arq] || '0'}` : null;
}

class TerritorioController {
    /**
     * GET /territorios — a lista completa, com os caminhos das imagens.
     * Leitura livre para qualquer irmao logado, como os quadros.
     */
    async index(req, res) {
        try {
            const { territorios } = carregarManifesto();
            return res.json({
                territorios: territorios.map((t) => ({
                    numero: t.numero,
                    localidade: t.localidade,
                    imagens: {
                        mapa: urlArquivo(t.arquivos.mapa),
                        satelite: urlArquivo(t.arquivos.satelite),
                        thumb: urlArquivo(t.arquivos.thumb),
                    },
                })),
            });
        } catch (error) {
            console.error('Erro ao ler o manifesto de territórios:', error);
            return res.status(500).json({ error: 'Erro ao buscar territórios' });
        }
    }
}

module.exports = new TerritorioController();
