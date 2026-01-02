-- Limpar tabelas existentes
TRUNCATE TABLE "Designacao" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Config" RESTART IDENTITY CASCADE;

-- Inserir Configuração Inicial
INSERT INTO "Config" ("titulo", "subtitulo", "mes", "updatedAt")
VALUES ('Quadro de Designações JANEIRO', 'Congregação', 'JAN', NOW());

-- Inserir Designações
INSERT INTO "Designacao" ("data", "dia", "funcao", "irmao1", "irmao2", "updatedAt", "createdAt") VALUES
('04/01', 'Domingo', 'Microfone Volante', 'Benjamin', 'Claudio', NOW(), NOW()),
('04/01', 'Domingo', 'Indicador', 'Edgar', 'Rudá', NOW(), NOW()),
('04/01', 'Domingo', 'Áudio e Vídeo', 'Ricardo', 'João Felipe', NOW(), NOW()),

('08/01', 'Quinta', 'Microfone Volante', 'Miguel', 'Kauã', NOW(), NOW()),
('08/01', 'Quinta', 'Indicador', 'Aloisio', 'José Santos', NOW(), NOW()),
('08/01', 'Quinta', 'Áudio e Vídeo', 'Everton', 'Matheus Lino', NOW(), NOW()),

('11/01', 'Domingo', 'Microfone Volante', 'Domingos Neto', 'Leonardo', NOW(), NOW()),
('11/01', 'Domingo', 'Indicador', 'Jucimar', 'José Santos', NOW(), NOW()),
('11/01', 'Domingo', 'Áudio e Vídeo', 'Henzel', 'Erick Matheus', NOW(), NOW()),

('15/01', 'Quinta', 'Microfone Volante', 'Ivo', 'Kauã', NOW(), NOW()),
('15/01', 'Quinta', 'Indicador', 'Francisco', 'Cristian', NOW(), NOW()),
('15/01', 'Quinta', 'Áudio e Vídeo', 'Everton', 'João Felipe', NOW(), NOW()),

('18/01', 'Domingo', 'Microfone Volante', 'Lázaro', 'Nicholas', NOW(), NOW()),
('18/01', 'Domingo', 'Indicador', 'Jucimar', 'Matheus Lino', NOW(), NOW()),
('18/01', 'Domingo', 'Áudio e Vídeo', 'Cristiandley', 'Erick Matheus', NOW(), NOW()),

('22/01', 'Quinta', 'Microfone Volante', 'Manoel', 'André Marques', NOW(), NOW()),
('22/01', 'Quinta', 'Indicador', 'Miguel', 'Domingos Neto', NOW(), NOW()),
('22/01', 'Quinta', 'Áudio e Vídeo', 'Everton', 'João Felipe', NOW(), NOW()),

('25/01', 'Domingo', 'Microfone Volante', 'Reginaldo', 'Manoel', NOW(), NOW()),
('25/01', 'Domingo', 'Indicador', 'Aloisio', 'Henzel', NOW(), NOW()),
('25/01', 'Domingo', 'Áudio e Vídeo', 'Harisson', 'Matheus Lino', NOW(), NOW()),

('29/01', 'Quinta', 'Microfone Volante', 'Cosmírio', 'Pedro', NOW(), NOW()),
('29/01', 'Quinta', 'Indicador', 'Rudá', 'Francisco', NOW(), NOW()),
('29/01', 'Quinta', 'Áudio e Vídeo', 'Matheus Lino', 'João Felipe', NOW(), NOW());
