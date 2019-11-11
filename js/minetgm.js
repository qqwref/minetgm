const PB_KEY = 'minetgm-pbs';

function Cell(number) {
    this.mine = 0;
    this.number = number;
    this.symbol = number;
    this.colorStyle = 'color: black';
    this.cssClasses = [];
}

var timeString = function(diff) {
    var millis = Math.floor(diff % 1000);
    diff = diff / 1000;
    var seconds = Math.floor(diff % 60);
    diff = diff / 60;
    var minutes = Math.floor(diff);

    return minutes + ':' +
           ("0" + seconds).slice (-2) + '.' +
           ("00" + millis).slice (-3);
};

var appData = {
    gridSize: 16,
    gridRange: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    cells: [], // 2D array of Cell

    rounds: 1,
    roundBreaks: true,
    showRounds: true,
    showTransitions: true,

    personalBests: {},

    groupColorStyles: ['color: green', 'color: red', 'color: blue', 'color: magenta', 'color: brown'],

    gameStarted: false,

    hoveredCell: [-1, -1],

    tableSize: 640,
    fontSize: 100,

    rowHeight: '40px',
    colWidth: '40px',
    tableWidth: 'calc(100vw - 100px)',
    tableHeight: 'calc(100vh - 100px)',
    cellFontSize: 'calc(8vmin - 8px)',

    dialogShowed: false,
    settingsTabVisible: true,
    statsTabVisible: false,

    stats: {
        startTime: new Date(),
        stopTime: new Date(),
        lastTime: new Date(),
        correctClicks: 0,
        wrongClicks: 0,
        clicks: [], // array of ClickStats
        rounds: [],
        clear: function () {
            this.startTime = new Date();
            this.stopTime = new Date();
            this.lastTime = new Date();
            this.correctClicks = 0;
            this.wrongClicks = 0;
            this.clicks = [];
            this.rounds = [];
        },
        resultTimeString: function () {
            const rounds = this.rounds.length;
            if (rounds < appData.rounds) return timeString(0);
            const total = this.totalTime();
            const time = timeString(total);

            if (rounds > 1) {
                const best = timeString(this.bestRoundTime());
                const avg = timeString(total / rounds);
                return `${time} (${avg} average, ${best} best)`;
            }

            return time;
        },
        totalCorrectClicks: function() {
            return this.correctClicks +
                this.rounds.reduce((a, r) => a + r.correctClicks, 0);
        },
        totalWrongClicks: function() {
            return this.wrongClicks +
                this.rounds.reduce((a, r) => a + r.wrongClicks, 0);
        },
        endRound: function() {
            const now = new Date();
            this.rounds.push({
                startTime: this.startTime,
                stopTime: now,
                clicks: this.clicks,
                correctClicks: this.correctClicks,
                wrongClicks: this.wrongClicks,
            });
            this.startTime = now;
            this.lastTime = now;
            this.clicks = [];
            this.correctClicks = 0;
            this.wrongClicks = 0;
        },
        roundTime: function(round) {
            const stat = this.rounds[round - 1];
            return stat ? stat.stopTime - stat.startTime : 0;
        },
        roundClicks: function(round) {
            const stat = this.rounds[round - 1];
            return stat ? stat.clicks : [];
        },
        bestRoundTime: function() {
            var result = Infinity;
            for (const round of this.rounds) {
                result = Math.min(result, round.stopTime - round.startTime);
            }
            return result;
        },
        roundTimeString: function(round) {
            return timeString(this.roundTime(round));
        },
        totalTime: function() {
            var result = 0;
            for (var i = 1; i <= this.rounds.length; i++) {
                result += this.roundTime(i);
            }
            return result;
        }
    }
};

Vue.directive('focus', {                   // https://jsfiddle.net/LukaszWiktor/cap43pdn/
    inserted: function (el) {
        el.focus();
    },
    update: function (el) {
        Vue.nextTick(function () {
            el.focus();
        })
    }
});

vueApp = new Vue({
    el: '#app',
    data: appData,
    created: function () {
        this.initGame();
        appData.personalBests =
            JSON.parse(localStorage.getItem(PB_KEY)) || {};
    },
    mounted: function () {
        this.execDialog('settings');
    },
    updated: function () {
        return;
    },
    watch: {
        rounds: function(val) {
            if (typeof(val) === 'string') {
                val = parseInt(val);
            }

            this.initGame();
        },
    },
    methods: {
        initGame: function () {
            this.gameStarted = false;
            this.initTable();
            this.stats.clear();
            function $(str) {return document.getElementById(str);}
            c = $('c').getContext('2d');
            $('c').height = 500;
            $('c').width = 500;
            $('c').addEventListener("mousedown", self.clicked, false);
            $('c').addEventListener("mouseup", self.clickup, false);
            
            c.font = "Bold 24px Arial";
            c.fillStyle = "black";
            c.textAlign = "center";
            c.fillText(""+6, 180 + 15, 180 + 24);
        },
        clicked: function (event) {
            return;
        },
        clickup: function (event) {
            return;
        },
        initTable: function () {
            this.clearIndexes();
            this.makeGridCells();
        },
        startGame: function () {
            this.initGame();
            if (this.timerMode) {
                clearTimeout(this.gameTimerId);
                this.gameTimerId = setTimeout(this.gameTimerOut, this.timerMinutes * 60 * 1000);
            }
            this.gameStarted = true;
        },
        startNextRound: function() {
            this.initTable();
            this.stats.startTime = new Date();
            this.stats.lastTime = this.stats.startTime;
        },
        currentRoundNumber: function() {
            return this.stats.rounds.length + 1;
        },
        stopGame: function () {
            this.clearIndexes();
            this.gameStarted = false;
        },
        updatePB: function() {
            const time = this.stats.totalTime();
            const currentPB = this.personalBests['0'];
            if (!currentPB || currentPB > time) {
                this.personalBests['0'] = time;
                localStorage.setItem(
                    PB_KEY,
                    JSON.stringify(this.personalBests),
                );
            }
        },
        pbTimeString: function() {
            const pb = this.personalBests['0'];
            return pb ? timeString(pb) : '';
        },
        clearIndexes: function () {
            this.hoveredCell = [-1, -1];
        },
        setHoveredCell: function (cellX, cellY, event) {
            this.hoveredCell = [cellX, cellY];
        },
        setClickedCell: function (cellX, cellY, event) {
            if (this.gameStarted) {
                this.processClick(cellX, cellY, event.button);
            }
        },
        setUnclickedCell: function (cellX, cellY, event) {
            return;
        },
        processClick: function (cellX, cellY, mouseButton) {
            console.log(cellX + ", " + cellY + " @ " + mouseButton);
        },
        tracedCell: function (cellIdx) {
            return this.cells[cellIdx].traced;
        },
        makeGridCells: function () {
            var g, i;
            var cellCount = this.gridSize * this.gridSize;

            this.cells = [];
            for (i = 0; i <= this.gridSize; i++) {
                var range = [];
                for (j = 0; j < this.gridSize; j++) {
                    range.push(new Cell());
                }
                this.cells.push(range);
            }
        },
        gameTimerOut: function () {
            this.stopGame();
            clearTimeout(this.gameTimerId);
            this.execDialog('stats');
        },
        execDialog: function (tabName) {
            this.stopGame();
            this.changeDialogTab(tabName);
            this.stats.stopTime = new Date();
            this.dialogShowed = true;
        },
        changeDialogTab: function (tabName) {
            this.statsTabVisible = false;
            this.settingsTabVisible = false;
            this.mousemapTabVisible = false;

            if (tabName === 'stats') {
                this.statsTabVisible = true;
            } else if (tabName === 'mousemap') {
                this.mousemapTabVisible = true; // see 'updated' section
            } else {
                this.settingsTabVisible = true;
            }
        },
        onEsc: function() {
            if (this.dialogShowed) {
                this.hideDialog();
            } else {
                this.execDialog('settings');
            }
        },
        hideDialog: function () {
            this.dialogShowed = false;
            if (!this.gameStarted) {
                this.startGame();
            }
        },
        rank: function () {
            return "GM";
        },
    }
});
