// Night mode toggle
const nightModeToggle = document.getElementById('nightModeToggle');
const body = document.body;

// Load night mode preference from localStorage
const isNightMode = localStorage.getItem('nightMode') === 'true';
if (isNightMode) {
    body.classList.add('night-mode');
    nightModeToggle.textContent = '☀️ Day Mode';
}

// Toggle night mode
nightModeToggle.addEventListener('click', () => {
    body.classList.toggle('night-mode');
    const isNightModeNow = body.classList.contains('night-mode');
    localStorage.setItem('nightMode', isNightModeNow);

    nightModeToggle.textContent = isNightModeNow ? '☀️ Day Mode' : '🌙 Night Mode';

    visualizer.redraw(); // Force redraw to update point colors
});


const canvas = document.getElementById('mainCanvas');
const controls = document.querySelector('.controls');

function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = controls.offsetHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class ForelVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.points = [];
        this.clusters = [];
        this.animationSteps = [];
        this.currentStep = 0;
        this.isAnimating = false;
        this.editMode = 'add';
        this.selectedPoint = null;
        this.R = 50;
        this.showHistory = true;
        this.colorClusters = true;
        this.clusterColors = new Map();

        this.setupEventListeners();
        this.redraw();

        document.getElementById('showHistory').addEventListener('change', e => {
            this.showHistory = e.target.checked;
            this.redraw();
        });

        document.getElementById('colorClusters').addEventListener('change', e => {
            this.colorClusters = e.target.checked;
            this.redraw();
        });

        document.getElementById('reset').addEventListener('click', () => this.resetAnimation());
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleCanvasClick.bind(this));

        document.getElementById('clearCanvas').addEventListener('click', () => visualizer.clearCanvas());
        document.getElementById('stepNext').addEventListener('click', () => this.step(1));
        document.getElementById('stepPrev').addEventListener('click', () => this.step(-1));
        document.getElementById('startPause').addEventListener('click', () => this.toggleAnimation());
        document.getElementById('startPause').addEventListener('click', function () {
            const isPaused = visualizer.isAnimating;
            this.innerHTML = isPaused
                ? 'Pause<span>⏸️</span>'
                : 'Start<span>▶️</span>';
            this.classList.toggle('paused', isPaused);
        });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setEditMode(btn.id.replace('mode', '').toLowerCase()));
        });
    }

    handleCanvasClick(e) {
        e.preventDefault(); // Prevent the context menu on right-click

        const pos = this.getMousePos(e);
        if (e.button === 0 && this.editMode === 'add') { // Left-click (button 0)
            this.addPoint(pos.x, pos.y);
        } else if (e.button === 2 && this.editMode === 'add') { // Right-click (button 2)
            const point = this.findPoint(pos.x, pos.y);
            if (point) {
                this.points = this.points.filter(p => p !== point);
                this.resetAnimation();
                this.redraw();
            }
        }
    }

    setEditMode(mode) {
        this.editMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn =>
            btn.classList.toggle('active', btn.id === `mode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)
        );
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        if (this.editMode === 'move') {
            this.selectedPoint = this.findPoint(pos.x, pos.y);
        } else if (this.editMode === 'delete') {
            const point = this.findPoint(pos.x, pos.y);
            if (point) {
                this.points = this.points.filter(p => p !== point);
                this.resetAnimation();
                this.redraw();
            }
        }
    }

    handleMouseMove(e) {
        if (this.editMode === 'move' && this.selectedPoint) {
            const pos = this.getMousePos(e);
            this.selectedPoint.x = pos.x;
            this.selectedPoint.y = pos.y;
            this.resetAnimation();
            this.redraw();
        }
    }

    handleMouseUp() {
        this.selectedPoint = null;
    }

    findPoint(x, y) {
        return this.points.find(p =>
            Math.hypot(p.x - x, p.y - y) < 10
        );
    }

    addPoint(x, y) {
        this.points.push({x, y});
        this.resetAnimation();
        this.redraw();
    }

    resetAnimation() {
        this.animationSteps = [];
        this.currentStep = 0;
        this.clusters = [];
        this.clusterColors.clear();
        this.isAnimating = false;
        this.updateStepCounter();
        this.redraw();

        const startPauseButton = document.getElementById('startPause');
        startPauseButton.innerHTML = 'Start<span>▶️</span>';
        startPauseButton.classList.remove('paused'); // Remove paused state
    }

    generateClusters() {
        this.R = parseInt(document.getElementById('paramR').value);
        const steps = [];
        let remainingPoints = [...this.points];
        this.clusterColors.clear();

        while (remainingPoints.length > 0) {
            const clusterId = this.clusters.length;
            const color = this.generateClusterColor(clusterId);
            this.clusterColors.set(clusterId, color);

            let center = remainingPoints[Math.floor(Math.random() * remainingPoints.length)];
            let prevCenter = null;
            let clusterPoints = [];

            while (!this.arePointsEqual(center, prevCenter)) {
                prevCenter = {...center};
                clusterPoints = remainingPoints.filter(p =>
                    Math.hypot(p.x - center.x, p.y - center.y) <= this.R
                );

                center = this.calculateCentroid(clusterPoints);
                steps.push({
                    type: 'move',
                    center: {...center},
                    points: [...clusterPoints],
                    clusterId: clusterId
                });
            }

            const finalCluster = {
                center: {...center},
                points: clusterPoints,
                id: clusterId
            };

            this.clusters.push(finalCluster);
            steps.push({
                type: 'final',
                cluster: {...finalCluster}
            });

            remainingPoints = remainingPoints.filter(p =>
                !finalCluster.points.includes(p)
            );
        }

        this.animationSteps = steps;
        this.currentStep = 0;
        this.updateStepCounter();
    }

    generateClusterColor(clusterId) {
        const hue = (clusterId * 137.5) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    calculateCentroid(points) {
        const sum = points.reduce((acc, p) => {
            acc.x += p.x;
            acc.y += p.y;
            return acc;
        }, {x: 0, y: 0});

        return {
            x: sum.x / points.length || 0,
            y: sum.y / points.length || 0
        };
    }

    arePointsEqual(a, b) {
        return a && b && a.x === b.x && a.y === b.y;
    }

    step(direction) {
        if (this.animationSteps.length === 0) {
            this.generateClusters();
        }

        const newStep = this.currentStep + direction;
        if (newStep >= 0 && newStep <= this.animationSteps.length) {
            this.currentStep = newStep;
            this.updateStepCounter();
            this.redraw();
        }
    }

    toggleAnimation() {
        this.isAnimating = !this.isAnimating;

        if (this.isAnimating) {
            if (this.animationSteps.length === 0 || this.currentStep >= this.animationSteps.length) {
                this.generateClusters();
            }
            this.animate();
        }
    }

    animate() {
        if (!this.isAnimating) return;

        if (this.currentStep < this.animationSteps.length) {
            this.currentStep++;
            this.updateStepCounter();
            this.redraw();
            setTimeout(() => this.animate(), parseInt(document.getElementById('speed').value));
        } else {
            this.isAnimating = false;
        }
    }

    updateStepCounter() {
        document.getElementById('currentStep').textContent =
            `${this.currentStep}/${this.animationSteps.length}`;
    }

    clearCanvas() {
        this.points = [];  // Remove all points
        this.clusters = []; // Clear clusters too
        this.resetAnimation();
        this.redraw();
    }

    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw history
        if (this.showHistory && this.currentStep > 0) {
            this.animationSteps.slice(0, this.currentStep).forEach(step => {
                if (step.type === 'move') {
                    const color = this.clusterColors.get(step.clusterId);

                    // Draw background
                    this.ctx.beginPath();
                    this.ctx.arc(step.center.x, step.center.y, this.R, 0, Math.PI * 2);
                    this.ctx.fillStyle = this.colorClusters ?
                        color.replace('hsl', 'hsla').replace(')', ', 0.1)') :
                        'rgba(0, 0, 255, 0.1)';
                    this.ctx.fill();

                    // Draw border
                    this.ctx.beginPath();
                    this.ctx.arc(step.center.x, step.center.y, this.R, 0, Math.PI * 2);
                    this.ctx.strokeStyle = this.colorClusters ?
                        color.replace('hsl', 'hsla').replace(')', ', 0.3)') :
                        'rgba(0, 0, 255, 0.3)';
                    this.ctx.stroke();
                }
            });
        }

        // Draw final centroids state
        const finalSteps = this.animationSteps
            .slice(0, this.currentStep)
            .filter(step => step.type === 'final');

        finalSteps.forEach(step => {
            const color = this.clusterColors.get(step.cluster.id);
            this.ctx.beginPath();
            this.ctx.arc(step.cluster.center.x, step.cluster.center.y, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = this.colorClusters ? color : 'green';
            this.ctx.fill();
        });

        // Draw current state
        if (this.currentStep > 0) {
            const currentStep = this.animationSteps[this.currentStep - 1];
            if (currentStep.type === 'move') {
                const color = this.clusterColors.get(currentStep.clusterId);

                // Draw current cluster
                this.ctx.beginPath();
                this.ctx.arc(currentStep.center.x, currentStep.center.y, this.R, 0, Math.PI * 2);
                this.ctx.strokeStyle = this.colorClusters ? color : 'blue';
                this.ctx.stroke();

                // Draw cluster points
                currentStep.points.forEach(p => {
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                    this.ctx.fillStyle = this.colorClusters ? color : 'red';
                    this.ctx.fill();
                });
            }
        }

        const isNightMode = document.body.classList.contains('night-mode');

        this.points.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            this.ctx.fillStyle = isNightMode ? '#ffffff' : '#000000';
            this.ctx.fill();
        });
    }
}

const visualizer = new ForelVisualizer(canvas);

function loadPreset() {
    const preset = document.getElementById('presets').value;
    visualizer.points = [];
    visualizer.resetAnimation();

    const width = canvas.width;
    const height = canvas.height;

    switch (preset) {
        case 'custom':
            // skip
            break;

        case 'two_clusters':
            for (let i = 0; i < 30; i++) {
                visualizer.addPoint(width * 0.25 + Math.random() * width * 0.2, height * 0.25 + Math.random() * height * 0.2);
                visualizer.addPoint(width * 0.65 + Math.random() * width * 0.2, height * 0.65 + Math.random() * height * 0.2);
            }
            break;

        case 'overlapping':
            const clusterCenterX1 = width * 0.45; // Move closer
            const clusterCenterY1 = height * 0.5;
            const clusterCenterX2 = width * 0.55;
            const clusterCenterY2 = height * 0.5;
            const radius = width * 0.07;

            for (let i = 0; i < 50; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * radius;

                visualizer.addPoint(clusterCenterX1 + Math.cos(angle) * r, clusterCenterY1 + Math.sin(angle) * r);
                visualizer.addPoint(clusterCenterX2 + Math.cos(angle) * r, clusterCenterY2 + Math.sin(angle) * r);
            }
            break;

        case 'noise':
            for (let i = 0; i < 100; i++) {
                visualizer.addPoint(Math.random() * width, Math.random() * height);
            }
            break;

        case 'circle':
            for (let i = 0; i < 100; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * width * 0.3;
                visualizer.addPoint(width * 0.5 + Math.cos(angle) * r, height * 0.5 + Math.sin(angle) * r);
            }
            break;

        case 'spiral':
            for (let i = 0; i < 150; i++) {
                const t = i / 150 * Math.PI * 4;
                const r = t * width * 0.02;
                visualizer.addPoint(width * 0.5 + Math.cos(t) * r, height * 0.5 + Math.sin(t) * r);
            }
            break;

        case 'grid':
            const gridSize = 8;
            for (let x = 0; x < gridSize; x++) {
                for (let y = 0; y < gridSize; y++) {
                    visualizer.addPoint(
                        width * (x + 1) / (gridSize + 1) + (Math.random() - 0.5) * width * 0.05,
                        height * (y + 1) / (gridSize + 1) + (Math.random() - 0.5) * height * 0.05
                    );
                }
            }
            break;

        case 'concentric_circles':
            for (let i = 0; i < 100; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * width * 0.3;
                visualizer.addPoint(width * 0.5 + Math.cos(angle) * r, height * 0.5 + Math.sin(angle) * r);
            }
            for (let i = 0; i < 50; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * width * 0.15;
                visualizer.addPoint(width * 0.5 + Math.cos(angle) * r, height * 0.5 + Math.sin(angle) * r);
            }
            break;

        case 'cross':
            for (let i = 0; i < 50; i++) {
                const x = width * 0.5 + (Math.random() - 0.5) * width * 0.4;
                const y = height * 0.5 + (Math.random() - 0.5) * height * 0.1;
                visualizer.addPoint(x, y);
            }
            for (let i = 0; i < 50; i++) {
                const x = width * 0.5 + (Math.random() - 0.5) * width * 0.1;
                const y = height * 0.5 + (Math.random() - 0.5) * height * 0.4;
                visualizer.addPoint(x, y);
            }
            break;

        case 'moon':
            for (let i = 0; i < 100; i++) {
                const angle = Math.random() * Math.PI;
                const r = Math.random() * width * 0.2;
                visualizer.addPoint(width * 0.3 + Math.cos(angle) * r, height * 0.5 + Math.sin(angle) * r);
            }
            for (let i = 0; i < 100; i++) {
                const angle = Math.random() * Math.PI + Math.PI;
                const r = Math.random() * width * 0.2;
                visualizer.addPoint(width * 0.7 + Math.cos(angle) * r, height * 0.5 + Math.sin(angle) * r);
            }
            break;

        case 'random_clusters':
            const numClusters = 5;
            for (let c = 0; c < numClusters; c++) {
                const cx = Math.random() * width;
                const cy = Math.random() * height;
                for (let i = 0; i < 30; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.random() * width * 0.1;
                    visualizer.addPoint(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
                }
            }
            break;
    }

    visualizer.redraw();
    if (visualizer.animationSteps.length === 0) {
        visualizer.generateClusters();
    }
}

const presetDescriptions = {
    custom: "<strong>Custom:</strong> Добавляйте, удаляйте и перемещайте точки вручную.",
    two_clusters: "<strong>Two Clusters:</strong> Два чётко разделённых облака точек.",
    overlapping: "<strong>Overlapping:</strong> Два кластера, частично перекрывающихся.",
    noise: "<strong>With Noise:</strong> Случайно разбросанные точки по всему холсту.",
    circle: "<strong>Circle:</strong> Точки, расположенные по кругу.",
    spiral: "<strong>Spiral:</strong> Точки, расположенные по спирали.",
    grid: "<strong>Grid:</strong> Точки, расположенные в виде сетки.",
    concentric_circles: "<strong>Concentric Circles:</strong> Два концентрических круга точек.",
    cross: "<strong>Cross:</strong> Точки, расположенные в виде креста.",
    moon: "<strong>Moon:</strong> Два полукруга, образующих форму луны.",
    random_clusters: "<strong>Random Clusters:</strong> Несколько случайно расположенных кластеров."
};

const presetsSelect = document.getElementById('presets');
const presetDescription = document.getElementById('presetDescription');

presetsSelect.addEventListener('change', () => {
    const selectedPreset = presetsSelect.value;
    presetDescription.innerHTML = presetDescriptions[selectedPreset];
    loadPreset();
});

presetDescription.innerHTML = presetDescriptions[presetsSelect.value];
presetsSelect.addEventListener('change', loadPreset);
