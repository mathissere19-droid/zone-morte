@echo off
cd /d "%~dp0"
title Zone Morte - serveur (laisser ouvert pendant le jeu)
start "" http://localhost:8642/
python -m http.server 8642
