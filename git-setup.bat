:: ============================================================
:: ISOHub — Setup Git e primeiro push
:: Execute no terminal do VS Code na pasta raiz do projeto
:: ============================================================

:: PASSO 1 — Verificar git instalado
git --version

:: PASSO 2 — Configurar identidade (altere com seus dados)
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"

:: PASSO 3 — Entrar na pasta raiz do projeto
cd E:\desenvolvimento\myprojects\iso8583-portal\Iso8583Toolkit

:: PASSO 4 — Inicializar repositório local
git init

:: PASSO 5 — Conectar ao repositório remoto
git remote add origin https://github.com/isohub-io/isohub.git

:: PASSO 6 — Copiar os arquivos gerados para a raiz do projeto
:: (copie LICENSE, README.md, CONTRIBUTING.md e .gitignore
::  para E:\desenvolvimento\myprojects\iso8583-portal\Iso8583Toolkit\)

:: PASSO 7 — Criar branch de release
git checkout -b release/v1.0.0

:: PASSO 8 — Verificar o que será commitado (revisar antes!)
git status

:: PASSO 9 — Adicionar todos os arquivos
git add .

:: PASSO 10 — Verificar novamente (confirmar que nada indesejado entrou)
git status

:: PASSO 11 — Primeiro commit
git commit -m "feat: initial release v1.0.0

- ISO 8583 parser (ASCII wire, binary-hex, TPDU auto-detect)
- Smart ISO builder with contextual field generation
- Bitmap decoder and builder
- EMV cryptogram tools (ARQC/ARPC/TLV/Full Flow)
- TCP Simulator (rebatedor + injector with continuous mode)
- Test card generator (PAN, tracks, CVV by brand)
- Workspace with IMK/ZPK configuration
- Standalone Docker Agent (.NET 9)
- PT-BR and EN support
- 487 tests, 0 failures"

:: PASSO 12 — Push para o GitHub
git push -u origin release/v1.0.0

:: ============================================================
:: APÓS O PUSH:
:: 1. Abrir https://github.com/isohub-io/isohub
:: 2. Clicar em "Compare & pull request"
:: 3. Base: main  ←  Compare: release/v1.0.0
:: 4. Título: "Release v1.0.0 — Initial release"
:: 5. Descrição: copiar do commit acima
:: 6. Clicar "Create pull request"
:: 7. Fazer o merge
:: 8. Criar tag:
::    git checkout main
::    git pull
::    git tag -a v1.0.0 -m "ISOHub v1.0.0 — Initial release"
::    git push origin v1.0.0
:: ============================================================
