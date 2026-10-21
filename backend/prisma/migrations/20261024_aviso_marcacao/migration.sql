-- Aviso de marcacao no territorio: tipo novo nas preferencias de notificacao.
-- Quem ja tinha salvo as preferencias guardou so os tipos de antes; sem isto, ficaria sem o
-- aviso novo sem nunca ter escolhido. Quem nao quiser desliga na tela. Seguro de reaplicar.
UPDATE "PreferenciaNotificacao"
SET "tipos" = array_append("tipos", 'territorio')
WHERE NOT ('territorio' = ANY("tipos"));
