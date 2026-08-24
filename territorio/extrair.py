# -*- coding: utf-8 -*-
"""
Extrai os cartões de território dos PDFs desta pasta para o backend.

Fonte (nesta pasta):
  - "Mapas de Territórios - Norte de Itapuã - Tokaia.pdf": territórios 01-08,
    DUAS páginas por território (a primeira é o mapa, a segunda a foto de
    satélite do mesmo recorte).
  - "Territórios Norte de Itapuã - Parte 2.pdf": territórios 09-27, uma página
    (mapa) por território.

Saída (backend/public/territorios/):
  - NN-mapa.jpg      render 4x da página (nítido o bastante para dar zoom)
  - NN-satelite.jpg  idem, só para 01-08
  - NN-thumb.jpg     render 1x, leve, para a lista do app
  - territorios.json manifesto com número, localidade e arquivos

Rodar de novo quando os cartões mudarem:  python extrair.py
O script é todo validado: se a estrutura dos PDFs mudar (par sem par, número
repetido, localidade ilegível), ele aborta com erro em vez de gerar lixo.
"""

import glob
import json
import os
import re
import sys

import fitz  # PyMuPDF
from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.normpath(os.path.join(AQUI, "..", "backend", "public", "territorios"))


def achar_pdf(trecho):
    """Localiza o PDF pelo trecho do nome — os acentos dos nomes reais vêm em
    normalização Unicode diferente (NFD) e a comparação literal falha."""
    achados = [p for p in glob.glob(os.path.join(AQUI, "*.pdf")) if trecho in p]
    if len(achados) != 1:
        raise SystemExit(f"ERRO: esperava 1 PDF com '{trecho}' no nome, achei {achados}")
    return achados[0]

# "Congregação Norte de Itapuã (Rua Vila Romana)" -> localidade = "Rua Vila Romana"
RE_LOCALIDADE = re.compile(r"Congrega\S+ Norte de Itapu\S+\s*\(([^)]+)\)")
RE_NUMERO = re.compile(r"^\s*(\d{2})\s*$", re.MULTILINE)


def ler_pagina(page):
    """(numero, localidade) extraídos do texto da página, ou erro claro."""
    texto = page.get_text()
    m_loc = RE_LOCALIDADE.search(texto)
    m_num = RE_NUMERO.search(texto)
    if not m_loc or not m_num:
        raise SystemExit(
            f"ERRO: não achei localidade/número na página {page.number + 1} "
            f"de {os.path.basename(page.parent.name)}. Texto:\n{texto[:400]}"
        )
    return int(m_num.group(1)), m_loc.group(1).strip()


def salvar(page, caminho, zoom, qualidade, corrigir=None):
    """Renderiza a página em JPG. `corrigir=(impresso, certo)` troca o número
    do cartão NA IMAGEM.

    O conserto é feito em pixel, não no PDF: o número visível vem do appearance
    stream do campo de formulário, que sobrevive a redações — editar o PDF
    deixava o "06" antigo por cima do texto novo.
    """
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    if corrigir is None:
        pix.save(caminho, jpg_quality=qualidade)
        return

    impresso, certo = corrigir
    alvos = [
        r for r in page.search_for(f"{impresso:02d}")
        # O número do cartão fica na linha do cabeçalho, canto direito.
        if r.y1 < page.rect.height * 0.2 and r.x0 > page.rect.width * 0.6
    ]
    if len(alvos) != 1:
        raise SystemExit(
            f"ERRO: esperava 1 ocorrência de '{impresso:02d}' no cabeçalho da "
            f"página {page.number + 1}, achei {len(alvos)}."
        )
    r = alvos[0]
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    draw = ImageDraw.Draw(img)
    # Cobre o número antigo com branco (com folga) e escreve o certo por cima,
    # na mesma fonte serifada do formulário (Times bold).
    caixa = (int(r.x0 * zoom) - 2, int(r.y0 * zoom) - 2,
             int(r.x1 * zoom) + 3, int(r.y1 * zoom) + 3)
    draw.rectangle(caixa, fill="white")
    fonte = ImageFont.truetype(r"C:\Windows\Fonts\timesbd.ttf", int(r.height * zoom * 1.05))
    draw.text(((caixa[0] + caixa[2]) / 2, caixa[3]), f"{certo:02d}",
              font=fonte, fill="black", anchor="ms")
    img.save(caminho, quality=qualidade)


def main():
    os.makedirs(SAIDA, exist_ok=True)
    territorios = {}

    # ---- Parte 1: pares (mapa, satélite) -------------------------------------
    PDF_PARTE1 = achar_pdf("Tokaia")
    PDF_PARTE2 = achar_pdf("Parte 2")
    doc1 = fitz.open(PDF_PARTE1)
    if len(doc1) % 2 != 0:
        raise SystemExit(f"ERRO: {PDF_PARTE1} tem {len(doc1)} páginas — esperava pares.")
    impresso_anterior = None
    for i in range(0, len(doc1), 2):
        mapa, satelite = doc1[i], doc1[i + 1]
        numero, localidade = ler_pagina(mapa)
        numero2, localidade2 = ler_pagina(satelite)
        if (numero, localidade) != (numero2, localidade2):
            raise SystemExit(
                f"ERRO: páginas {i + 1}/{i + 2} de {PDF_PARTE1} não são o mesmo "
                f"território ({numero}/{localidade} vs {numero2}/{localidade2})."
            )
        # O número que VALE é o da posição. Mas o auto-conserto vale SÓ para o
        # defeito conhecido: o cartão sai impresso com o MESMO número do cartão
        # imediatamente anterior (copy-paste sem atualizar o campo — foi o caso
        # dos cartões 07 e 08, ambos impressos "06"). Qualquer outra
        # divergência — pares reordenados, renumeração — aborta: renumerar em
        # silêncio publicaria o mapa de um território com o número de outro.
        posicao = i // 2 + 1
        impresso = numero
        conserto = None
        if numero != posicao:
            if impresso == impresso_anterior:
                print(f"AVISO: cartão na posição {posicao} veio impresso como "
                      f"{impresso:02d} (duplicata do anterior); corrigindo o "
                      f"número no cartão para {posicao:02d}.")
                conserto = (impresso, posicao)
                numero = posicao
            else:
                raise SystemExit(
                    f"ERRO: cartão na posição {posicao} de {PDF_PARTE1} está "
                    f"impresso como {impresso:02d} — não é a duplicata "
                    f"consecutiva conhecida. Confira a ordem dos cartões no "
                    f"PDF antes de re-rodar."
                )
        impresso_anterior = impresso
        nn = f"{numero:02d}"
        salvar(mapa, os.path.join(SAIDA, f"{nn}-mapa.jpg"), 4, 88, conserto)
        salvar(satelite, os.path.join(SAIDA, f"{nn}-satelite.jpg"), 4, 85, conserto)
        salvar(mapa, os.path.join(SAIDA, f"{nn}-thumb.jpg"), 1, 78, conserto)
        territorios[numero] = {
            "numero": numero,
            "localidade": localidade,
            "arquivos": {
                "mapa": f"{nn}-mapa.jpg",
                "satelite": f"{nn}-satelite.jpg",
                "thumb": f"{nn}-thumb.jpg",
            },
        }
    doc1.close()

    # ---- Parte 2: uma página (mapa) por território ---------------------------
    doc2 = fitz.open(PDF_PARTE2)
    for page in doc2:
        numero, localidade = ler_pagina(page)
        if numero in territorios:
            raise SystemExit(f"ERRO: território {numero} aparece nos dois PDFs.")
        nn = f"{numero:02d}"
        salvar(page, os.path.join(SAIDA, f"{nn}-mapa.jpg"), 4, 88)
        salvar(page, os.path.join(SAIDA, f"{nn}-thumb.jpg"), 1, 78)
        territorios[numero] = {
            "numero": numero,
            "localidade": localidade,
            "arquivos": {
                "mapa": f"{nn}-mapa.jpg",
                "satelite": None,
                "thumb": f"{nn}-thumb.jpg",
            },
        }
    doc2.close()

    # ---- Validação final e manifesto -----------------------------------------
    numeros = sorted(territorios)
    esperados = list(range(1, len(numeros) + 1))
    if numeros != esperados:
        raise SystemExit(f"ERRO: numeração com buracos/duplicatas: {numeros}")

    manifesto = {
        "territorios": [territorios[n] for n in numeros],
    }
    with open(os.path.join(SAIDA, "territorios.json"), "w", encoding="utf-8") as f:
        json.dump(manifesto, f, ensure_ascii=False, indent=2)

    total_kb = sum(
        os.path.getsize(os.path.join(SAIDA, a)) for a in os.listdir(SAIDA)
    ) // 1024
    print(f"OK: {len(numeros)} territórios -> {SAIDA} ({total_kb} KB no total)")
    for n in numeros:
        t = territorios[n]
        sat = " +satélite" if t["arquivos"]["satelite"] else ""
        print(f"  {n:02d}  {t['localidade']}{sat}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
