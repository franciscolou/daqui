# Testar o app no celular (Android) com o backend local

Guia pra rodar o Daqui num **emulador Android** (Android Studio) usando um
**development build** (dev client próprio, `expo-dev-client`) conversando
com o backend local (WSL2). O emulador tem um endereço fixo (`10.0.2.2`)
que sempre aponta pro `localhost` do PC — e o WSL2 já encaminha `localhost`
automaticamente pro backend, então não precisa mexer em firewall, IP da
Wi-Fi ou portproxy.

Por que dev client em vez de Expo Go: o app usa módulos nativos
(`expo-build-properties`, `expo-notifications`, etc.) que exigem um build
próprio — o Expo Go genérico não cobre.

## Passo a passo

1. **Instale o Android Studio** (traz SDK + emulador):
   ```powershell
   winget install --id Google.AndroidStudio --accept-package-agreements --accept-source-agreements
   ```
2. Abra o Android Studio, complete o wizard inicial (baixa os componentes
   do SDK).
3. **Device Manager** → **Create Virtual Device** → escolha um device tipo
   Pixel com uma imagem de sistema recente → baixa a imagem se pedido →
   Finish.
4. Dê play no emulador criado (▶) e espere ele terminar de bootar.
5. No WSL, aponte o frontend pro emulador:
   ```bash
   ./scripts/use-emulator-env.sh   # copia frontend/.env.emulator -> .env.local
   ```
6. Gere o development build (só precisa refazer isso quando mudar código
   nativo/plugin do `app.json`, não a cada alteração de JS/TS):
   ```bash
   cd frontend
   npx eas-cli build --platform android --profile development
   ```
   Baixa e instala o APK gerado no emulador (arraste o `.apk` pra dentro da
   janela do emulador, ou baixe o link/QR que a EAS mostra ao final).
7. Suba o backend + Metro:
   ```bash
   cd ~/daqui && ./dev.sh
   ```
8. Abra o app instalado no emulador — ele já vem configurado pra procurar o
   Metro em `10.0.2.2:8081` sozinho. Testa o login — deve conectar direto.

Quando terminar de testar e quiser voltar a usar o navegador normal:
```bash
./scripts/use-web-env.sh   # remove o .env.local, volta ao default localhost
```
(reinicie o `dev.sh` depois de trocar, o Expo só lê o `.env.local` na
subida).

Se WHPX (acelerador do emulador) reclamar de conflito de virtualização:
não deveria dar problema, já que WSL2 e o Android Emulator hoje dividem o
mesmo Hyper-V — mas se der, é sinal de precisar habilitar a "Windows
Hypervisor Platform" em "Ativar ou desativar recursos do Windows".
