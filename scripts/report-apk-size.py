"""Tamanho do APK e dos maiores arquivos dentro dele. Avisa (nao falha) acima do orcamento.
Uso: python3 scripts/report-apk-size.py <apk>"""
import sys, zipfile

APK_ANTES = 4_930_875      # APK antes do icone/splash nativos (referencia)
ORCAMENTO = 7 * 1024 ** 2  # meta: abaixo de 7 MiB
apk = sys.argv[1]
z = zipfile.ZipFile(apk)
infos = z.infolist()
size = sum(i.compress_size for i in infos)
import os
disk = os.path.getsize(apk)
splash = [i for i in infos if i.filename.startswith('res/') and i.filename.endswith('splash.png')]
print(f'APK: {disk:,} bytes ({disk / 1024**2:.2f} MiB); referencia anterior {APK_ANTES:,} ({APK_ANTES / 1024**2:.2f} MiB); diferenca {disk - APK_ANTES:+,}')
print(f'splash no APK: {len(splash)} imagens, {sum(i.compress_size for i in splash) / 1024:.0f} KiB')
print('maiores entradas (comprimido):')
for i in sorted(infos, key=lambda i: -i.compress_size)[:10]:
    print(f'  {i.compress_size / 1024:8.0f} KiB  {i.filename}')
if disk > ORCAMENTO: print(f'::warning::APK acima de 7 MiB ({disk / 1024**2:.2f} MiB)')
