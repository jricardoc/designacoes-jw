/**
 * Verificacao da leitura do My Maps e das regras de territorio.
 *
 *   npm run verificar:territorios
 *
 * Nao precisa de banco nem de internet: o KML e montado aqui, no formato que o My Maps exporta.
 *
 * Por que isto existe: um erro aqui nao quebra nada de forma visivel. Um poligono lido com
 * latitude e longitude trocadas cai no oceano; um "onde paramos" que ignora a conclusao manda
 * o grupo de volta a um territorio terminado; um numero sugerido errado liga o mapa ao cartao
 * de outro territorio.
 */
const MyMaps = require('../src/services/MyMapsService');
const { normalizarNumero, coresDasAreas, _internos: T } = require('../src/services/TerritoriosService');

let falhas = 0;
const eq = (achado, esperado, descricao) => {
    const ok = JSON.stringify(achado) === JSON.stringify(esperado);
    if (ok) {
        console.log(`   ok   ${descricao}`);
    } else {
        falhas += 1;
        console.log(`   FALHA ${descricao}\n         esperado ${JSON.stringify(esperado)}\n         veio     ${JSON.stringify(achado)}`);
    }
};
const ok = (condicao, descricao) => eq(!!condicao, true, descricao);

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Mapa da Congrega&#231;&#227;o</name>
    <Style id="poly-0288D1-3301-77-nodesc-normal"><PolyStyle><color>4dd18802</color></PolyStyle></Style>
    <Folder>
      <name>Importado (vazia)</name>
    </Folder>
    <Folder>
      <name>Bispo &amp; Xang&#244;</name>
      <Placemark>
        <name><![CDATA[Qd. 1 ]]></name>
        <styleUrl>#poly-0288D1-3301-77-nodesc</styleUrl>
        <Polygon><outerBoundaryIs><LinearRing><tessellate>1</tessellate>
          <coordinates>
            -38.0,-12.0,0 -37.9,-12.0,0 -37.9,-11.9,0 -38.0,-11.9,0 -38.0,-12.0,0
          </coordinates>
        </LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
      <Placemark>
        <name>Pino solto</name>
        <Point><coordinates>-38.0,-12.0,0</coordinates></Point>
      </Placemark>
    </Folder>
    <Folder>
      <name>Casinhas 1</name>
      <Placemark>
        <name>R. Venceslau</name>
        <styleUrl>#poly-01579B-3401-77-nodesc</styleUrl>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>-38.1,-12.1,0 -38.0,-12.1,0 -38.05,-12.0,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>
    </Folder>
  </Document>
</kml>`;

console.log('=== 1. Leitura do KML do My Maps ===\n');
const lido = MyMaps.lerKml(KML);
eq(lido.nomeMapa, 'Mapa da Congregação', 'nome do mapa com entidades numericas decodificadas');
eq(lido.camadas.map(c => c.nome), ['Bispo & Xangô', 'Casinhas 1'], 'camada vazia fica de fora; &amp; vira &');
eq(lido.camadas[0].quadras.map(q => q.nome), ['Qd. 1'], 'CDATA aberto e aparado');
eq(lido.ignorados, 1, 'pino (Point) e contado e ignorado');
eq(lido.camadas[0].quadras[0].pontos[0], [-12, -38], 'coordenada vira [lat, lng] (o KML e lng,lat)');
eq(lido.camadas[0].quadras[0].pontos.length, 4, 'ponto que fecha o anel nao se repete');
eq(lido.camadas[0].cor, '#0288D1', 'cor sai do id do estilo');
eq(lido.camadas[1].quadras[0].cor, '#01579B', 'cada quadra com a sua cor');

console.log('\n=== 2. Link do My Maps ===\n');
eq(MyMaps.extrairMid('https://www.google.com/maps/d/edit?mid=1jFujFGSe9ML8k6oMYzF19Eu36RwQX9c&usp=sharing'),
    '1jFujFGSe9ML8k6oMYzF19Eu36RwQX9c', 'link de edicao');
eq(MyMaps.extrairMid('https://www.google.com/maps/d/embed?mid=1-5Ip4Crn4jcR5hXhVh7h61XP9w76i1E&ehbc=2E312F'),
    '1-5Ip4Crn4jcR5hXhVh7h61XP9w76i1E', 'link de incorporacao (iframe)');
eq(MyMaps.extrairMid('1fAmmPPCgvF2vhm60dybIjP3OSC875ZY'), '1fAmmPPCgvF2vhm60dybIjP3OSC875ZY', 'so o id');
eq(MyMaps.extrairMid('https://evil.com/?mid=../../x'), null, 'mid com caractere invalido e recusado');
eq(MyMaps.extrairMid(''), null, 'vazio e recusado');

console.log('\n=== 3. Ponto dentro da quadra ===\n');
const quadrado = lido.camadas[0].quadras[0].pontos;
ok(MyMaps.dentro([-11.95, -37.95], quadrado), 'centro do quadrado esta dentro');
ok(!MyMaps.dentro([-11.95, -38.05], quadrado), 'a oeste esta fora');
ok(!MyMaps.dentro([-37.95, -11.95], quadrado), 'lat e lng trocadas caem fora (protege a ordem)');

console.log('\n=== 4. Numero sugerido ===\n');
const existentes = [
    { numero: '05', nome: 'Casinhas' },
    { numero: '15', nome: 'Casinhas 1' },
    { numero: '10', nome: 'VASP - Atrás do Posto' },
    { numero: '11', nome: 'VASP - Jardim Itapuã' },
    { numero: '06', nome: 'Cond. Recanto' },
];
const camadas = [
    { nome: 'Casinhas - Tokaia', quadras: [{ nome: 'Casinhas 1' }] },
    { nome: 'Casinhas 1', quadras: [{ nome: 'R. Venceslau' }] },
    { nome: 'VASP 2', quadras: [{ nome: 'Alameda Jardim Itapuã' }] },
    { nome: 'VASP', quadras: [{ nome: 'Atrás do Posto' }] },
    { nome: 'Territorio condomínio', quadras: [{ nome: 'Rua Madrid' }] },
];
eq(MyMaps.sugerirNumeros(camadas, existentes), ['05', '15', '11', '10', null],
    'casa pelo nome da camada e das quadras, sem repetir; sem semelhanca fica em branco');

console.log('\n=== 5. Numero do territorio ===\n');
eq(normalizarNumero('1'), '01', '1 -> 01');
eq(normalizarNumero(' 6a '), '06A', '6a -> 06A');
eq(normalizarNumero('012'), '12', 'zero a esquerda a mais sai');
eq(normalizarNumero('Rural'), 'RURAL', 'texto fica como texto');

console.log('\n=== 6. Situacao e onde paramos ===\n');
const s = (dia, extra = {}) => ({ dia, createdAt: `${dia}T15:00:00Z`, status: 'ativa', concluiu: false, quadraId: null, ...extra });
eq(T.situacao({ naoIniciado: false }, [], false), 'sem_registro', 'sem nada: sem registro');
eq(T.situacao({ naoIniciado: false }, [], true), 'andamento', 'so marcacao ja e andamento');
eq(T.situacao({ naoIniciado: false }, [s('2026-10-01'), s('2026-10-08', { concluiu: true })], false), 'concluido', 'uma conclusao no ciclo: concluido');
eq(T.situacao({ naoIniciado: true }, [s('2026-10-01')], false), 'nao_iniciado', 'nao iniciado confirmado vence');

const paradas = T.ondeParamos([
    s('2026-10-01', { id: 1, quadraId: 7 }),
    s('2026-10-05', { id: 2, quadraId: 7 }),
    s('2026-10-03', { id: 3, quadraId: 8 }),
    s('2026-10-06', { id: 4, quadraId: 8, status: 'descartada' }),
]);
eq(paradas.map(p => p.id).sort(), [2, 3], 'a mais recente de cada quadra; descartada nao conta');
eq(T.ondeParamos([s('2026-10-01', { id: 1 }), s('2026-10-01', { id: 2, status: 'conflito' })]).map(p => p.id), [1],
    'registro em conflito espera a revisao; vale o que ja estava');
eq(T.ondeParamos([s('2026-10-01', { id: 1 }), s('2026-10-09', { id: 2, concluiu: true })]).length, 0,
    'conclusao depois da parada zera o "onde paramos"');
eq(T.ondeParamos([s('2026-10-01', { id: 1, concluiu: true }), s('2026-10-09', { id: 2 })]).map(p => p.id), [2],
    'parada depois da conclusao volta a valer');

console.log('\n=== 7. Nao bater e ano de servico ===\n');
const agora = new Date('2026-10-20T12:00:00Z');
ok(T.precisaReconfirmar({ tipo: 'nao_bater', marcadaEm: '2026-07-01T12:00:00Z' }, agora), 'mais de 90 dias: reconfirmar');
ok(!T.precisaReconfirmar({ tipo: 'nao_bater', marcadaEm: '2026-05-01T12:00:00Z', reconfirmadaEm: '2026-10-01T12:00:00Z' }, agora),
    'reconfirmada ha pouco: nao');
ok(!T.precisaReconfirmar({ tipo: 'parada', marcadaEm: '2025-01-01T12:00:00Z' }, agora), 'so Nao bater vence');
eq(T.anoDeServico(2027), { de: '2026-09-01', ate: '2027-08-31' }, 'ano de servico 2027 = set/2026 a ago/2027');
eq(T.diasEntre('2026-09-30', '2026-10-30'), 30, 'dias entre datas');

console.log('\n=== 8. Contorno e cor das areas ===\n');
// Quadrado de `lado` metros com o canto sudoeste deslocado (dy, dx) metros de um ponto em Salvador.
const M_LAT = 1 / 110540;
const M_LNG = 1 / (111320 * Math.cos((-12.93 * Math.PI) / 180));
const quadradoEmMetros = (dy, dx, lado = 60) => [[0, 0], [0, lado], [lado, lado], [lado, 0]]
    .map(([y, x]) => [-12.93 + (dy + y) * M_LAT, -38.36 + (dx + x) * M_LNG]);
const centroDe = (q) => [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2];
const a1 = quadradoEmMetros(0, 0);
const a2 = quadradoEmMetros(0, 80); // 20 m de rua: a mesma area fecha por cima
const b1 = quadradoEmMetros(0, 150); // 10 m de rua para a area vizinha
const longe = quadradoEmMetros(1000, 0); // outro pedaco da area A, longe
const [ca, cb] = MyMaps.contornarAreas([
    { nome: 'A', poligonos: [a1, a2, longe] },
    { nome: 'B', poligonos: [b1] },
]);
const dentroDeAlgum = (p, aneis) => aneis.some(anel => MyMaps.dentro(p, anel));
eq(ca.aneis.length, 2, 'area com um pedaco longe: dois aneis');
// 3 m para dentro de cada canto: onde a rua e estreita demais para a folga, o contorno encosta na quadra.
const recuado = (q) => q.map(([lat, lng]) => {
    const [clat, clng] = centroDe(q);
    return [lat + Math.sign(clat - lat) * 3 * M_LAT, lng + Math.sign(clng - lng) * 3 * M_LNG];
});
ok([a1, a2, longe].flatMap(recuado).every(p => dentroDeAlgum(p, ca.aneis)), 'o contorno envolve todas as quadras da area');
ok(dentroDeAlgum([-12.93 + 30 * M_LAT, -38.36 + 70 * M_LNG], ca.aneis), 'a rua entre quadras da mesma area fica dentro');
ok(!dentroDeAlgum(centroDe(b1), ca.aneis), 'nao engole a quadra da area vizinha');
ok(!recuado(b1).some(p => dentroDeAlgum(p, ca.aneis)) && ![a1, a2].flatMap(recuado).some(p => dentroDeAlgum(p, cb.aneis)),
    'separadas por uma rua: um contorno nao cobre quadra do outro');
eq(MyMaps.contornarAreas([{ nome: 'vazia', poligonos: [] }]), [], 'area sem quadra: sem contorno');
eq(MyMaps.corDaLinha('<LineStyle><color>efb27550</color><width>5</width></LineStyle>'), '#5075B2', 'cor da linha do KML (aabbggrr)');
eq(MyMaps.corDaLinha('<Style/>'), null, 'KML sem linha: sem cor');
eq(coresDasAreas([{ numero: '14', area: 'Ex' }, { numero: '01', area: 'Tokaia' }, { numero: '02', area: null }], { Ex: '#E53935' }),
    { Tokaia: '#1E88E5', Ex: '#E53935' }, 'cor escolhida fica; sem escolha, a proxima livre da paleta');

console.log(falhas === 0 ? '\n*** TODAS AS VERIFICACOES PASSARAM ***' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
