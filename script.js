document.addEventListener('DOMContentLoaded', () => {

    // ── Elementos da tela ──────────────────────────────────────
    // Pega referências de todos os elementos do HTML que o JS
    // precisa ler ou alterar durante o jogo.
    const board          = document.getElementById('game-board');
    const bird           = document.getElementById('bird');
    const pipesLayer     = document.getElementById('pipes-layer');
    const scoreEl        = document.getElementById('score');
    const highScoreEl    = document.getElementById('high-score');
    const levelEl        = document.getElementById('level');
    const startScreen    = document.getElementById('start-screen');
    const pauseScreen    = document.getElementById('pause-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const finalScoreText = document.getElementById('final-score-text');
    const startButton    = document.getElementById('start-button');
    const resumeButton   = document.getElementById('resume-button');
    const restartButton  = document.getElementById('restart-button');
    const btnStart       = document.getElementById('btn-start');
    const btnPause       = document.getElementById('btn-pause');
    const btnReset       = document.getElementById('btn-reset');
    const btnDelHs       = document.getElementById('btn-del-hs');
    const themeBtns      = document.querySelectorAll('.theme-btn');

    // ── Temas ──────────────────────────────────────────────────
    // Cada tema é um conjunto de variáveis CSS (ver styles.css).
    // Trocar de tema é só trocar o atributo data-theme na <html>
    // e salvar a escolha no localStorage para lembrar na próxima visita.
    function applyTheme(name) {
        document.documentElement.dataset.theme = name === 'default' ? '' : name;
        themeBtns.forEach(b =>
            b.classList.toggle(
                'active', b.dataset.theme === name
            )
        );
        localStorage.setItem('flappyTheme', name);
    }
    const savedTheme = localStorage.getItem('flappyTheme') || 'default';
    applyTheme(savedTheme);
    themeBtns.forEach(btn => btn.addEventListener('click',
            () => applyTheme(btn.dataset.theme)
        )
    );
    // ── Constantes de física e dificuldade ─────────────────────
    const GRAVITY = 1500;     // px/s² — aceleração que puxa o pássaro para baixo
    const FLAP_VELOCITY = -420;     // px/s — velocidade instantânea ao pular
    const MAX_FALL_SPEED = 620;     // px/s — velocidade máxima de queda
    const BIRD_SIZE = 30;     // px — tamanho do pássaro
    const PIPE_WIDTH = 52;     // px — largura de cada cano
    const GROUND_HEIGHT = 14;     // px — altura do chão
    const BASE_PIPE_SPEED = 150;     // velocidade inicial dos canos
    const BASE_GAP = 165;     // abertura inicial entre os canos
    const MIN_GAP = 100;     // abertura mínima
    const PIPE_INTERVAL_BASE = 1500;     // intervalo inicial entre os canos
    const MIN_PIPE_INTERVAL = 950;     // intervalo mínimo entre canos
    const LEVEL_EVERY = 5;    // quantidade de pontos para subir de fase
    // ── Estado do jogo ─────────────────────────────────────────
    let boardWidth;
    let boardHeight;
    let birdX;
    let birdY;
    let birdVelocity;
    let pipes;
    let score;
    let level;
    let pipeSpeed;
    let pipeGap;
    let pipeInterval;
    let timeSincePipe;
    let highScore =         Number(localStorage.getItem('flappyHighScore')) || 0;
    let isRunning = false;
    let isPaused = false;
    let animationId = null;
    let lastTimestamp = null;
    highScoreEl.textContent = highScore;
    // ── Medir tabuleiro ────────────────────────────────────────
    function measureBoard() {
        const rect = board.getBoundingClientRect();
        boardWidth = rect.width;
        boardHeight = rect.height;
    }
        window.addEventListener('resize', measureBoard);
    // ── Preparar uma nova partida ──────────────────────────────
    function resetState() {
        measureBoard();
        birdX = boardWidth * 0.25;
        birdY = boardHeight * 0.45;
        birdVelocity = 0;
        pipes = [];
        score = 0;
        level = 1;
        pipeSpeed = BASE_PIPE_SPEED;
        pipeGap = BASE_GAP;
        pipeInterval = PIPE_INTERVAL_BASE;
        timeSincePipe = 0;
        scoreEl.textContent = 0;
        levelEl.textContent = 1;
        pipesLayer.innerHTML = '';
    }
    // ── Criação de um novo cano ────────────────────────────────
    function spawnPipe() {
        const usableHeight = boardHeight - GROUND_HEIGHT;
        const minTop = 30;
        const maxTop = usableHeight - pipeGap - 30;
        const topHeight = minTop + Math.random() * Math.max(10, maxTop - minTop);
        // Cano superior
        const topEl = document.createElement('div');
        topEl.className = 'pipe pipe-top';
        topEl.style.height = topHeight + 'px';
        // Cano inferior
        const bottomHeight = usableHeight - topHeight - pipeGap;
        const bottomEl = document.createElement('div');
        bottomEl.className = 'pipe pipe-bottom';
        bottomEl.style.height = Math.max(bottomHeight, 20) + 'px';
        pipesLayer.appendChild(topEl);
        pipesLayer.appendChild(bottomEl);
        pipes.push({
            x: boardWidth,
            topHeight,
            bottomHeight,
            topEl,
            bottomEl,
            passed: false
        });
    }
    // ── Atualização da física e lógica ─────────────────────────
    function update(dt) {
        // Gravidade
        birdVelocity = Math.min(birdVelocity + GRAVITY * dt, MAX_FALL_SPEED);
        birdY += birdVelocity * dt;
       // ── Colisão com o teto ──
        if (birdY < 0) {
            birdY = 0;
            birdVelocity = 0;
        }
        // ── Colisão com o chão ──
        if (birdY + BIRD_SIZE >= boardHeight - GROUND_HEIGHT ) {
            birdY = boardHeight - GROUND_HEIGHT - BIRD_SIZE;
            endGame();
            return;
        }
        // ── Criar novos canos ──
        timeSincePipe += dt * 1000;
        if ( timeSincePipe >= pipeInterval ) {
            timeSincePipe = 0;
            spawnPipe();
        }
        // ── Movimentação dos canos ──
        for (let i = pipes.length - 1; i >= 0; i--) {
            const pipe = pipes[i];
            pipe.x -= pipeSpeed * dt;
            // ── Pontuação ──
            if (!pipe.passed &&pipe.x + PIPE_WIDTH < birdX) {
                pipe.passed = true;
                score++;
                scoreEl.textContent = score;
                checkLevelUp();
            }
            // ── Verificação de colisão ──
            const overlapsX = birdX + BIRD_SIZE > pipe.x && birdX < pipe.x + PIPE_WIDTH;
            if (overlapsX) {
                const hitsTop = birdY < pipe.topHeight;
                const hitsBottom = birdY + BIRD_SIZE > boardHeight - GROUND_HEIGHT - pipe.bottomHeight;
                if (hitsTop || hitsBottom ) {
                    endGame();
                    return;
                }
            }
            // ── Remover canos fora da tela ──
            if (pipe.x + PIPE_WIDTH < 0 ) {
                pipe.topEl.remove();
                pipe.bottomEl.remove();
                pipes.splice(i, 1);
            }
        }
    }
    // ── Sistema de níveis ──────────────────────────────────────
    function checkLevelUp() {
        if (score % LEVEL_EVERY === 0) {
            level++;
            levelEl.textContent = level;            // Aumenta velocidade
            pipeSpeed = Math.min( pipeSpeed + 18, 340);               // Diminui abertura
            pipeGap = Math.max(MIN_GAP, pipeGap - 8);            // Diminui intervalo
            pipeInterval = Math.max( MIN_PIPE_INTERVAL, pipeInterval - 60 );
        }
    }
    // ── Renderização ───────────────────────────────────────────
    function render() {
        bird.style.top = birdY + 'px';        // Inclinação do pássaro
        const angle = Math.max( -25, Math.min(90,birdVelocity / 8));
        bird.style.transform =`rotate(${angle}deg)`;
        // Atualiza posição dos canos
        pipes.forEach(pipe => {
            pipe.topEl.style.left = pipe.x + 'px';
            pipe.bottomEl.style.left = pipe.x + 'px';
        });
    }
    // ── Game Loop ──────────────────────────────────────────────
    function gameLoop(timestamp) {
        if (!isRunning ||isPaused) {
            return;
        }
       if (lastTimestamp === null) {
            lastTimestamp = timestamp;
        }  
        let dt = (timestamp - lastTimestamp) /1000;
        lastTimestamp =  timestamp;
        // Evita saltos grandes
        dt = Math.min( dt, 0.05 );
        update(dt);         // update() pode encerrar o jogo
        if (!isRunning) {
            return;
        }
        render();
        animationId = requestAnimationFrame( gameLoop );
    }
    // ── Fim de jogo ────────────────────────────────────────────
    function endGame() {
        isRunning = false;
        isPaused = false;
        cancelAnimationFrame(animationId);
        lastTimestamp = null;
        // Atualiza recorde
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('flappyHighScore',highScore);
            highScoreEl.textContent = highScore;
        }
        finalScoreText.textContent =`Pontuação: ${score}  •  Fase: ${level}`;
        showOverlay(gameOverScreen);
    }
    // ── Controle dos overlays ──────────────────────────────────
    const OVERLAYS = [
        startScreen,
        pauseScreen,
        gameOverScreen
    ];
    function showOverlay(el) {
        OVERLAYS.forEach(overlay =>
                overlay.classList.add('hidden')
        );
        el.classList.remove('hidden');
    }
    function hideAllOverlays() {
        OVERLAYS.forEach(overlay =>
                overlay.classList.add('hidden')
        );
    }
    // ── Iniciar partida ────────────────────────────────────────
    function startGame() {
        resetState();
        hideAllOverlays();
        isRunning = true;
        isPaused = false;
        lastTimestamp = null;
        cancelAnimationFrame(animationId);
        animationId = requestAnimationFrame(gameLoop);
    }
    // ── Pulo do pássaro ───────────────────────────────────────
    function flap() {        // Se ainda não começou,  inicia a partida.
        if (!isRunning) {
            startGame();
            return;
        }
        if (isPaused) {
            return;
        }
        birdVelocity = FLAP_VELOCITY;
    }
    // ── Pausar / continuar ─────────────────────────────────────
    function togglePause() {
        if (!isRunning) {
            return;
        }
        if (isPaused) {        // Retomar
            isPaused = false;
            hideAllOverlays();
            lastTimestamp = null;
            animationId = requestAnimationFrame( gameLoop );
        } else {            // Pausar
            isPaused = true;
            cancelAnimationFrame(animationId);
            showOverlay(pauseScreen);
        }
    }
    // ── Apagar recorde ─────────────────────────────────────────
    function deleteHighScore() {
        localStorage.removeItem( 'flappyHighScore' );
        highScore = 0;
        highScoreEl.textContent = 0;
    }
    // ── Botões da interface ────────────────────────────────────
    startButton.addEventListener('click',startGame);
    resumeButton.addEventListener('click',togglePause);
    restartButton.addEventListener('click',startGame);
    btnStart.addEventListener('click',startGame);
    btnPause.addEventListener('click',togglePause);
    btnReset.addEventListener('click',startGame);
    btnDelHs.addEventListener('click',deleteHighScore);
    // ── Mouse e touchscreen ────────────────────────────────────
    board.addEventListener('touchstart',
        e => {e.preventDefault(); flap();},
        {passive: false});
    board.addEventListener('mousedown',flap);
    // ── Teclado ────────────────────────────────────────────────
    document.addEventListener('keydown',e => { // Impede a barra de espaço de rolar a página.
            if (e.key === ' ') {
                e.preventDefault();
            }
            switch (e.key.toLowerCase()) {
                // Espaço = pular
                case ' ': flap();
                    break;
                // C = começar
                case 'c': startGame();
                    break;
                // P = pausar
                case 'p': togglePause();
                    break;
                // R = reiniciar
                case 'r': startGame();
                    break;
            }
        });
    // ── Inicialização ──────────────────────────────────────────
    measureBoard();
});