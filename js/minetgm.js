const PB_KEY = 'minetgm-pbs';

function timeString(diff) {
    var millis = Math.floor(diff % 1000);
    diff = diff / 1000;
    var seconds = Math.floor(diff % 60);
    diff = diff / 60;
    var minutes = Math.floor(diff);

    return minutes + ':' +
           ("0" + seconds).slice (-2) + '.' +
           ("00" + millis).slice (-3);
}

function $(str) {
    return document.getElementById(str);
}

function contains(arr, element) {
    // does array contain element?
    for (var i=0; i<arr.length; i++) {
        if (JSON.stringify(arr[i]) == JSON.stringify(element)) {
            return true;
        }
    }
    return false;
}

function isSubset(arr1, arr2) {
    // is array 1 a subset of array 2?
    for (var i=0; i<arr1.length; i++) {
        if (!contains(arr2,arr1[i])) {
            return false;
        }
    }
    return true;
}

function setMinus(arr1, arr2) {
    // array 1 minus array 2
    return arr1.filter(function(a) {return (!contains(arr2,a));});
}

function setIntersect(arr1, arr2) {
    // array 1 intersect array 2
    return arr1.filter(function(a) {return (contains(arr2,a));});
}
    
function getBrowser() {
    // http://www.quirksmode.org/js/detect.html
    var versionSearchString;
    var dataBrowser = [
        {string:navigator.userAgent, subString:"Chrome", identity:"Chrome"},
        {string:navigator.userAgent, subString:"Safari", identity:"Chrome"},
        {string:navigator.userAgent, subString:"Firefox", identity:"Firefox"},
        {string:navigator.userAgent, subString:"MSIE", identity:"IE", versionSearch:"MSIE"}];
                
    function searchString(data) {
        for (var i=0;i<data.length;i++) {
            var dataString = data[i].string;
            var dataProp = data[i].prop;
            if (dataString) {
                if (dataString.indexOf(data[i].subString) != -1)
                    return data[i].identity;
            } else if (dataProp) {
                return data[i].identity;
            }
        }
    };
                
    return searchString(dataBrowser) || "An unknown browser";
}

var appData = {
    tableSize: 480,
    cellSize: 30,
    dialogShowed: false,
    settingsTabVisible: true,
    statsTabVisible: false,
    
    h: 16, // height
    w: 16, // width
    m: 40, // mines
    remainingMines: 40,
    integerTime: 0,
    board: [], // h*w, -1 = mine, 0-8 = square
    boardKnowledge: [], // h*w, -1 = unknown, 0 = clear, 1 = mine
    colors: ["#fff", "#000", "#888", "#f00", "#0f0", "#00f", "#ff0", "#f80", "#f0f", "#007", "#050", "#700", "#fbb", "#0ff"],
    defaultColors: ["#FFFFFF", "#0000FF", "#008000", "#FF0000", "#000080", "#800000", "#008080", "#000000", "#808080"], // colors of 0-8
    secretColors: [], // number -> associated color
    colorKnowledge: [], // color# (from secretColors) -> set of possible numbers
    sets: [], // [color#, number (-1 if not certain), set of cells]
    colorRestriction: 0, // 0 = none, 1 = random, 2 = blind
    
    // Mines, flags, numbers, color restriction
    LEVEL_TYPES: [
        [30, true, true, 0],
        [40, true, true, 0],
        [40, false, true, 0],
        [40, false, false, 0],
        [40, false, false, 1],
        [52, true, true, 0],
        [64, true, true, 0],
        [64, false, true, 0],
        [64, false, false, 0],
        [64, false, false, 1],
        [40, true, false, 2]
    ],
    FIRST_TORIKAN: 180000, // PB 93.370 (9.515, 26.825, 41.665, 65.101, 93.370)
    SECOND_TORIKAN: 500000, // PB 315.315
    GRADES: ["F", "D", "C", "B", "A", "S", "S+", "⭐", "🌟", "✨", "M", "GM"],

    playing: false,
    needOpen: 0,
    level: 0,
    showNumbers: true,
    allowFlags: true,
    startTime: 0,
    timerInteval: null,
    finalTime: 0,
    levelName: "LEVEL 1",
    splits: [],
    grade: "",
    personalBests: [[0,0],[0,0],[0,0],[0,0],[0,0]],
    bonusLevelTime: 0,
    gameOverMessage: "",
    c: $('c').getContext('2d') // canvas
};

Vue.directive('focus', { // https://jsfiddle.net/LukaszWiktor/cap43pdn/
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
        localBests = JSON.parse(localStorage.getItem(PB_KEY)) || [];
        if (localBests.length > 0)
            appData.personalBests = localBests;
    },
    mounted: function () {
        this.execDialog('settings');
        this.initGame();
    },
    updated: function () {
        return;
    },
    watch: {
    },
    methods: {
        initGame: function () {
            this.playing = false;
            this.startTime = new Date();
            this.finalTime = 0;
            $('c').height = 500;
            $('c').width = 500;
            $('c').addEventListener("mousedown", this.clicked, false);
            $('c').addEventListener("mouseup", this.clickup, false);
            
            this.level = -1;
            this.levelName = "LEVEL 1";
            this.splits = [];
            this.grade = "";
            this.gameOverMessage = "";
            this.drawEmpty();
        },
        
        nextLevel: function(y, x) {
            this.level++;
            if (this.level == this.LEVEL_TYPES.length) {
                this.levelName = "BONUS";
            } else {
                this.levelName = "LEVEL " + (this.level + 1);
            }
            this.grade = this.GRADES[this.level];
            if (this.level > 0) {
                this.splits = this.splits.concat(new Date() - this.startTime);
            }
            if (this.level >= this.LEVEL_TYPES.length) {
                this.victory();
                return;
            }
            
            this.m = this.LEVEL_TYPES[this.level][0];
            this.remainingMines = this.m;
            this.allowFlags = this.LEVEL_TYPES[this.level][1];
            this.showNumbers = this.LEVEL_TYPES[this.level][2];
            this.colorRestriction = this.LEVEL_TYPES[this.level][3];
            
            console.log("Level: " + this.level + "<br>Mines: " + this.m + "<br>Flags: " + (this.allowFlags ? "yes" : "no") + "<br>Numbers: " + (this.showNumbers ? "yes" : "no") + "<br>Colors: " + (this.colorRestriction == 0 ? "normal" : (this.colorRestriction == 1 ? "random" : "no")));
 
            if (x==-1 && y==-1) {
                x = Math.floor(Math.random()*this.w);
                y = Math.floor(Math.random()*this.h);
            }
            this.generateBoard(x, y);
 
            this.needOpen = this.h*this.w - this.m;
            this.initBoardKnowledge();
            this.openSquare(y,x);
            this.playing = true;

            this.draw();
            this.timerInterval = setInterval(this.updateTimer, 10);
        },
        
        updateTimer: function() {
            time = new Date();
            if (!this.playing) {
                clearInterval(this.timerInterval);
                return;
            }
            if (this.level < 10) {
                this.integerTime = Math.floor((time - this.startTime) / 1000);
            } else {
                var remainingTime = 60 - ((time - this.bonusLevelTime) / 1000);
                this.integerTime = Math.ceil(remainingTime);
                if (remainingTime < 0) {
                    this.death();
                }
            }
        },
        
        generateBoard: function(x,y) {
            // generate a solvable board with known h, w, m, colorRestriction
            
            this.board=[];
            this.boardKnowledge=[];
            this.secretColors=[];
            this.colorKnowledge=[];
            this.sets=[];
            
            // determine basics
            this.tryGenerateBoard(y,x);
            this.chooseSecretColors();

            // init knowledge
            for (var ii=0; ii<10; ii++) {
                for (var i=0; i<1000; i++) {
                    this.initKnowledge();

                    // open starting square
                    this.openSquare(y,x);

                    // use logic to figure stuff out
                    this.useLogic();
   
                    if (!this.isSolvable()) {
                        this.perturb(y,x);
                    }
                    if (this.isSolvable()) {
                        console.log("Took " + i + " perturbs");
                        return;
                    }
                }
  
                console.log("Failed at " + i + " perturbs");
            }
        },
        
        clicked: function(event) {
            if (!event)
                event = window.event;
            if(event.preventDefault) {
                event.preventDefault();
                event.stopPropagation();
            }
            var x=0, y=0;
            var rect = $('c').getBoundingClientRect();
            if (event.x || event.y) {
                x = Math.floor((event.x - rect.left)/this.cellSize);
                y = Math.floor((event.y - rect.top)/this.cellSize);
            } else {
                x = Math.floor((event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft - rect.left)/this.cellSize);
                y = Math.floor((event.clientY + document.body.scrollTop + document.documentElement.scrollTop - rect.top)/this.cellSize);
            }
            if (x<0 || y<0 || x>=this.w || y>=this.h) {
                return;
            }
            var leftClick = event.button != 2;
            if (leftClick) { // left click
                if (this.boardKnowledge[y][x] == 1) return;
                if (this.board[y][x] >= 0) { // open square
                    if (this.boardKnowledge[y][x] > -1) { // chord?
                        this.chord(y,x);
                    } else { // open square
                        this.openSquare(y,x);
                        this.draw();
                    }
                } else { // click on mined square
                    this.death();
                }
            } else { // right click
                if (!this.allowFlags) return;
                if (this.boardKnowledge[y][x] == 1) { // flagged
                    this.remainingMines += 1;
                    this.boardKnowledge[y][x] = -1;
                    this.draw();
                } else if (this.boardKnowledge[y][x] == -1) { // flag
                    this.remainingMines -= 1;
                    this.boardKnowledge[y][x] = 1;
                    this.draw();
                }
            }
        },

        clickup: function(event) {
            if (!event)
                event = window.event;
            if(event.preventDefault) {
                event.preventDefault();
                event.stopPropagation();}
        },

        death: function() {
            this.draw();
            this.gameOverMessage = "Game Over";
            this.finalTime = (new Date() - this.startTime);
            this.updatePB();
            this.execDialog('stats');
        },
        
        victory: function() {
            this.draw();
            this.gameOverMessage = "Congratulations!";
            this.finalTime = (new Date() - this.startTime);
            this.updatePB();
            this.execDialog('stats');
        },
        
        tryGenerateBoard: function(y,x) {
            // array
            this.board=[];
            for (var i=0; i<this.h; i++) {
                this.board[i]=[];
                for (var j=0; j<this.w; j++) {
                    this.board[i][j]=0;
                }
            }
            // mines and numbers
            for (var n=0; n<this.m; n++) {
                while (true) {
                    yy = Math.floor(Math.random()*this.h);
                    xx = Math.floor(Math.random()*this.w);
                    if (this.board[yy][xx] != -1 && (Math.abs(yy-y) > 1 || Math.abs(xx-x) > 1)) {
                        // place mine
                        this.board[yy][xx] = -1;
                        for (var i=Math.max(0, yy-1); i<Math.min(this.h, yy+2); i++) {
                            for (var j=Math.max(0, xx-1); j<Math.min(this.w, xx+2); j++) {
                                if (this.board[i][j] != -1) {
                                    this.board[i][j] = this.board[i][j]+1;
                                }
                            }
                        }
                        break;
                    }
                }
            }
        },

        chooseSecretColors: function() {
            this.secretColors = [];
            for (var i=0; i<9; i++) {
                while (this.secretColors.length == i) {
                    var col = Math.floor(Math.random() * this.colors.length);
                    if (this.secretColors.indexOf(col) == -1) {
                        this.secretColors.push(col);
                    }
                }
            }
        },

        initKnowledge: function() {
            this.initBoardKnowledge();
            this.initColorKnowledge();
            this.sets = [];
        },

        initBoardKnowledge: function() {
            for (var i=0; i<this.h; i++) {
                this.boardKnowledge[i]=[];
                for (var j=0; j<this.w; j++) {
                    this.boardKnowledge[i][j]=-1;
                }
            }
        },

        initColorKnowledge: function() {
            if (this.colorRestriction == 1) {
                this.colorKnowledge[0] = [0];
                for (var i=1; i<this.secretColors.length; i++) {
                    this.colorKnowledge[i] = [1,2,3,4,5,6,7,8];
                }
            } else {
                this.colorKnowledge = [[0],[1],[2],[3],[4],[5],[6],[7],[8]];
            }
        },
        
        openSquare: function(y,x) {
            // floodfill
            queue = [[y,x]];
            queue_cnt = 0;
            while (queue_cnt < queue.length) {
                element = queue[queue_cnt];
                queue_cnt++;
                if (this.boardKnowledge[element[0]][element[1]] == -1) { // haven't been here
                    this.boardKnowledge[element[0]][element[1]] = 0;
                    this.needOpen--;
                    if (this.needOpen == 0 && this.playing) {
                        var curTime = (new Date() - this.startTime);
                        if (this.level == 4 && (curTime > this.FIRST_TORIKAN)) {
                            this.level++;
                            this.grade = this.GRADES[this.level];
                            this.splits = this.splits.concat(curTime);
                            this.victory();
                        } else if (this.level == 9 && (curTime > this.SECOND_TORIKAN)) {
                            this.level++;
                            this.grade = this.GRADES[this.level];
                            this.splits = this.splits.concat(curTime);
                            this.victory();
                        } else {
                            if (this.level == 9) {
                                this.bonusLevelTime = new Date();
                            }
                            this.nextLevel(y,x);
                        }
                        return;
                    }
                    if (this.board[element[0]][element[1]] == 0) { // opening
                        for (var ii=Math.max(0, element[0]-1); ii<Math.min(this.h, element[0]+2); ii++) {
                            for (var jj=Math.max(0, element[1]-1); jj<Math.min(this.w, element[1]+2); jj++) {
                                if (this.boardKnowledge[ii][jj] == -1 && !contains(queue, [ii,jj])) {
                                    queue.push([ii,jj]);
                                }
                            }
                        }
                    }
                }
            }
            
            // make sets for non-openings in queue
            for (var i=0; i<queue.length; i++) {
                if (this.board[queue[i][0]][queue[i][1]] == 0)
                    continue;
                var realColor = this.board[queue[i][0]][queue[i][1]];
                var subSet = [this.secretColors[realColor], -1, []];
                if (this.colorKnowledge[realColor].length == 1) {
                    subSet[1] = realColor;
                }
                for (var ii=Math.max(0, queue[i][0]-1); ii<Math.min(this.h, queue[i][0]+2); ii++) {
                    for (var jj=Math.max(0, queue[i][1]-1); jj<Math.min(this.w, queue[i][1]+2); jj++) {
                        if (this.boardKnowledge[ii][jj] != 0) {
                            subSet[2].push([ii,jj]);
                        }
                    }
                }
                this.sets.push(subSet);
            }
        },

        chord: function(y,x) {
            var flagged = 0;
            for (var i=Math.max(0, y-1); i<Math.min(this.h, y+2); i++) {
                for (var j=Math.max(0, x-1); j<Math.min(this.w, x+2); j++) {
                    if (this.boardKnowledge[i][j] == 1) flagged++;
                }
            }
            if (flagged != this.board[y][x]) return;
            var curLevel = this.level;
            for (var i=Math.max(0, y-1); i<Math.min(this.h, y+2); i++) {
                for (var j=Math.max(0, x-1); j<Math.min(this.w, x+2); j++) {
                    if (this.boardKnowledge[i][j] == -1) {
                        if (this.board[i][j] == -1) {
                            this.death();
                            return;
                        } else {
                            this.openSquare(i,j);
                            if (this.level != curLevel) return;
                        }
                    }
                }
            }
            this.draw();
        },
        
        useLogic: function() {
            var deduction = true; // at each stage, did we make a deduction?
            var cnt = 0;
            while (deduction==true && cnt<1000) {
                cnt++;
                deduction = false;
                
                // set logic
                var i = this.sets.length;
                while (i--) {
                    var cells = this.sets[i][2];
                    if (cells.length == 0) {
                        this.sets.splice(i, 1);
                        continue;
                    }
                    
                    var opened = 0, flagged = 0, unknown = 0;
                    for (var j=0; j<cells.length; j++) {
                        if (this.boardKnowledge[cells[j][0]][cells[j][1]] == 0) {
                            opened++;
                        } else if (this.boardKnowledge[cells[j][0]][cells[j][1]] == 1) {
                            flagged++;
                        } else if (this.boardKnowledge[cells[j][0]][cells[j][1]] == -1) {
                            unknown++;
                        } else {
                            alert("wat?");
                        }
                    }
                    var minNum = flagged, maxNum = flagged+unknown;
                    
                    if (this.colorRestriction < 2) {
                        // remove known squares from set and adjust number
                        if ((opened>0 || flagged>0) && this.sets[i][1] >= 0) {
                            this.sets[i][1] -= flagged;
                            this.sets[i][2] = [];
                            for (cell in cells) {
                                if (this.boardKnowledge[cell[0]][cell[1]] == -1) {
                                    this.sets[i][2].push(cell);
                                }
                            }
                            this.sets[i][2] = cells.filter(function(boardKnowledge) {
                                return function(a) {return (boardKnowledge[a[0]][a[1]] == -1)}
                            }(this.boardKnowledge));
                            cells = this.sets[i][2];
                            deduction = true;
                            opened = 0;
                            flagged = 0;
                        } else if (opened>0 && this.sets[i][1] == -1) {
                            this.sets[i][2] = cells.filter(function(boardKnowledge) {
                                return function(a) {return (boardKnowledge[a[0]][a[1]] != 0)}
                            }(this.boardKnowledge));
                            cells = this.sets[i][2];
                            deduction = true;
                            opened = 0;
                        }
                        
                        // remove garbage sets
                        if (unknown == 0 && this.sets[i][1] >= 0) {
                            this.sets.splice(i, 1);
                            deduction = true;
                            continue;
                        }
                        
                        // set with unknown number, learn about the color
                        if (this.sets[i][1] == -1) {
                            // make sure sets[i][0] color doesn't correspond to any invalid numbers
                            var cols = this.colorKnowledge[this.secretColors.indexOf(this.sets[i][0])];
                            var cols2 = cols.filter(function(minNum, maxNum) {
                                return function(a) {return (a>=minNum && a<=maxNum)}
                            }(minNum, maxNum));
                            if (JSON.stringify(cols) != JSON.stringify(cols2)) {
                                this.colorKnowledge[this.secretColors.indexOf(this.sets[i][0])] = cols2;
                                deduction = true;
                                break;
                            }
                        }
                        
                        // set with known number, all unknown squares are mines or open
                        if (this.sets[i][1] >= 0) {
                            // open all squares?
                            if (this.sets[i][1] == 0) {
                                for (var j=0; j<cells.length; j++) {
                                    if (this.boardKnowledge[cells[j][0]][cells[j][1]] == -1) {
                                        //boardKnowledge[cells[j][0]][cells[j][1]] = 0;
                                        this.openSquare(cells[j][0], cells[j][1]);
                                    }
                                }
                                this.sets.splice(i, 1); // remove set
                                deduction = true;
                                continue;
                            // mark all mines?
                            } else if (this.sets[i][1] == unknown) {
                                for (var j=0; j<cells.length; j++) {
                                    if (this.boardKnowledge[cells[j][0]][cells[j][1]] == -1) {
                                        this.boardKnowledge[cells[j][0]][cells[j][1]] = 1;
                                    }
                                }
                                this.sets.splice(i, 1); // remove set
                                deduction = true;
                                continue;
                            }
                        }
                        
                        // compare to other sets
                        // both sets must have known numbers, or else the same color
                        for (var j=this.sets.length-1; j>i; j--) {
                            var intersection = setIntersect(this.sets[i][2], this.sets[j][2]);
                            if (intersection.length == 0) continue;
                            var iMinusj = setMinus(this.sets[i][2], this.sets[j][2]);
                            var jMinusi = setMinus(this.sets[j][2], this.sets[i][2]);
                        
                            // if i and j are the same set
                            if (iMinusj.length == 0 && jMinusi.length == 0) {
                                if (this.sets[i][1] == -1) this.sets[i][1] = this.sets[j][1]; // take number info from j
                                this.sets.splice(j, 1); // remove j
                                deduction = true;
                                continue;
                            // if j contains i
                            } else if (iMinusj.length == 0) {
                                // no good if colors are different and at least one is unknown
                                if (!((this.sets[i][1]==-1 && this.sets[j][1]==-1 && this.sets[i][0]==this.sets[j][0]) || (this.sets[i][1]>-1 && this.sets[j][1]>-1))) continue;
                                this.sets[j][2] = jMinusi;
                                this.sets[j][1] -= this.sets[i][1];
                                // sets[j][0]?
                                deduction = true;
                            // if i contains j
                            } else if (jMinusi.length == 0) {
                                // no good if colors are different and at least one is unknown
                                if (!((this.sets[i][1]==-1 && this.sets[j][1]==-1 && this.sets[i][0]==this.sets[j][0]) || (this.sets[i][1]>-1 && this.sets[j][1]>-1))) continue;
                                this.sets[i][2] = iMinusj;
                                this.sets[i][1] -= this.sets[j][1];
                                // sets[j][0]?
                                deduction = true;
                            // 2-1 with i bigger
                            } else if (this.sets[i][1] != -1 && this.sets[j][1] != -1 && this.sets[i][1] - this.sets[j][1] == iMinusj.length) {
                                // everything in iMinusj is a mine
                                for (var k=0; k<iMinusj.length; k++) {
                                    if (this.boardKnowledge[iMinusj[k][0]][iMinusj[k][1]] == -1) {
                                        this.boardKnowledge[iMinusj[k][0]][iMinusj[k][1]] = 1;
                                    }
                                }
                                // everything in jMinusi is empty
                                for (var k=0; k<jMinusi.length; k++) {
                                    if (this.boardKnowledge[jMinusi[k][0]][jMinusi[k][1]] == -1) {
                                        this.openSquare(jMinusi[k][0], jMinusi[k][1]);
                                    }
                                }
                                // replace i with intersection
                                this.sets[i][2] = intersection;
                                this.sets[i][1] = this.sets[j][1];
                                // delete j
                                this.sets.splice(j, 1);
                                deduction = true;
                                continue;
                            // 2-1 with j bigger
                            } else if (this.sets[i][1] != -1 && this.sets[j][1] != -1 && this.sets[j][1] - this.sets[i][1] == jMinusi.length) {
                                // everything in jMinusi is a mine
                                for (var k=0; k<jMinusi.length; k++) {
                                    if (this.boardKnowledge[jMinusi[k][0]][jMinusi[k][1]] == -1) {
                                        this.boardKnowledge[jMinusi[k][0]][jMinusi[k][1]] = 1;
                                    }
                                }
                                // everything in iMinusj is empty
                                for (var k=0; k<iMinusj.length; k++) {
                                    if (this.boardKnowledge[iMinusj[k][0]][iMinusj[k][1]] == -1) {
                                        this.openSquare(iMinusj[k][0], iMinusj[k][1]);
                                    }
                                }
                                // replace i with intersection
                                this.sets[i][2] = intersection;
                                // delete j
                                this.sets.splice(j, 1);
                                deduction = true;
                                continue;
                            }
                        }
                    } else if (this.colorRestriction == 2) {
                        // we can open all squares if all flags are known
                        if (this.sets[i][1] == flagged) {
                            for (var j=0; j<cells.length; j++) {
                                if (this.boardKnowledge[cells[j][0]][cells[j][1]] == -1) {
                                    this.openSquare(cells[j][0], cells[j][1]);
                                }
                            }
                            this.sets.splice(i, 1); // remove set
                            deduction = true;
                            continue;
                        }
                        // if all are known and there is exactly one flag left, flag it
                        if (unknown==1 && this.sets[i][1] == flagged+1) {
                            for (var j=0; j<cells.length; j++) {
                                if (this.boardKnowledge[cells[j][0]][cells[j][1]] == -1) {
                                    this.boardKnowledge[cells[j][0]][cells[j][1]] = 1;
                                }
                            }
                            this.sets.splice(i, 1); // remove set
                            deduction = true;
                            continue;
                        }
                    }
                }
            
                // color logic
                if (this.colorRestriction == 1) {
                    for (var i=1; i<this.colorKnowledge.length; i++) {
                        // solved color
                        if (this.colorKnowledge[i].length == 1) {
                            // remove this number from other colors
                            for (var j=1; j<this.colorKnowledge.length; j++) {
                                if (j != i) {
                                    var colorIndex = this.colorKnowledge[j].indexOf(this.colorKnowledge[i][0]);
                                    if (colorIndex > -1) {
                                        this.colorKnowledge[j].splice(colorIndex, 1);
                                        deduction = true;
                                    }
                                }
                            }
                            // give number to sets with this color
                            for (var j=0; j<this.sets.length; j++) {
                                if (this.sets[j][0] == this.secretColors[i] && this.sets[j][1] == -1) {
                                    this.sets[j][1] = this.colorKnowledge[i][0];
                                    deduction = true;
                                }
                            }
                        }
                    }
                }
                // todo: more complex colors, etc.
            
                // new logic
                //[4,1,[[6,26],[7,26]]]
                //[11,-1,[[6,26],[7,26],[8,26],[8,28]]]
                //11 = [3,4]
                // => 11 = [3], [8,26] and [8,28] are mines
            
                // something goes wrong with random colors! the //WAT comments signify testing
                // I saw a thingy with a -2 clue. maybe that is part of the problem, not treating -1 clues properly. is it related to the thing about two equal colors?
            }
        
            if (cnt >= 999) {
            alert("infinite loop!");
            }
        },
        
        isSolvable: function() {
            // is this board solvable?
            // i.e. did our logic so far solve the puzzle?
            for (var i=0; i<this.h; i++) {
                for (var j=0; j<this.w; j++) {
                    if (this.boardKnowledge[i][j]==-1) return false;
                }
            }
            return true;
        },
        
        perturb: function(starty, startx) {
            function isFull(board, arr) {
                return board[arr[0]][arr[1]] == -1;
            }
            function makeEmpty(board, h, w, arr) {
                var yy = arr[0];
                var xx = arr[1];
                board[yy][xx] = 0;
                for (var i=Math.max(0, yy-1); i<Math.min(h, yy+2); i++) {
                    for (var j=Math.max(0, xx-1); j<Math.min(w, xx+2); j++) {
                        if (i==yy && j==xx) continue;
                        if (board[i][j] != -1) {
                            board[i][j] = board[i][j]-1;
                        } else {
                            board[yy][xx] = board[yy][xx]+1;
                        }
                    }
                }
            }
            function makeFull(board, h, w, arr) {
                var yy = arr[0];
                var xx = arr[1];
                board[yy][xx] = -1;
                for (var i=Math.max(0, yy-1); i<Math.min(h, yy+2); i++) {
                    for (var j=Math.max(0, xx-1); j<Math.min(w, xx+2); j++) {
                        if (i==yy && j==xx) continue;
                        if (board[i][j] != -1) {
                            board[i][j] = board[i][j]+1;
                        }
                    }
                }
            }
            
            // choose a set at random
            if (this.sets.length == 0) {
                // make a new set with everything we don't know
                var set = [];
                for (var i=0; i<this.h; i++) {
                    for (var j=0; j<this.w; j++) {
                        if (this.boardKnowledge[i][j]==-1) set.push([i,j]);
                    }
                }
                this.sets.push([0,0,set]);
            }
            var set_index = Math.floor(Math.random() * this.sets.length);
            var set_cells = this.sets[set_index][2];
            
            // Make a list of all the squares in the grid, in this order:
            // - first, unknown squares on the boundary of known space
            // - next, unknown squares beyond that boundary
            // - last, known squares, but not within one square of the starting position.
            // Um, but don't count anything in our set or next to the starting point!
            var unknownBeyondBoundary = [];
            var unknownInBoundary = [];
            var known = [];
            for (var i=0; i<this.h; i++) {
                for (var j=0; j<this.w; j++) {
                    if (contains(set_cells, [i,j])) continue;
                    if (i>=starty-1 && i<=starty+1 && j>=startx-1 && j<=startx+1) continue;
                    if (this.boardKnowledge[i][j] > -1) {
                        known.push([i,j]);
                    } else {
                        // is on boundary?
                        var onBoundary = false;
                        for (var ii=Math.max(0, i-1); ii<Math.min(this.h, i+2); ii++) {
                            for (var jj=Math.max(0, j-1); jj<Math.min(this.w, j+2); jj++) {
                                if (this.boardKnowledge[ii][jj] > -1) {
                                    onBoundary = true;
                                    break;
                                }
                            }
                        }
                        if (onBoundary) {
                            unknownInBoundary.push([i,j]);
                        } else {
                            unknownBeyondBoundary.push([i,j]);
                        }
                    }
                }
            }
            // Randomly shuffle each of these sections individually, and combine them.
            unknownBeyondBoundary = this.shuffle(unknownBeyondBoundary);
            unknownInBoundary = this.shuffle(unknownInBoundary);
            known = this.shuffle(known);
            var combinedSquares = unknownInBoundary.concat(unknownBeyondBoundary).concat(known);
            
            // Count the number of full and empty squares in the perturbing set.
            var nfull = 0, nempty = 0;
            for (var i=0; i<set_cells.length; i++) {
                if (isFull(this.board, set_cells[i])) {
                    nfull++;
                } else {
                    nempty++;
                }
            }
            
            // Go through the squares list until we find either 'nfull' empty squares or 'nempty' full squares
            var squarePtr = 0, nemptyList = 0, nfullList = 0;
            for (squarePtr=0; squarePtr<combinedSquares.length; squarePtr++) {
                if (isFull(this.board, combinedSquares[squarePtr])) {
                    nfullList++;
                } else {
                    nemptyList++;
                }
                if ((nfullList == nempty && nempty>0) || (nemptyList == nfull && nfull>0)) {
                    break;
                }
            }
            
            // If we couldn't find enough...
            if (squarePtr == combinedSquares.length) {
                // Randomly fill a random selection of our perturbing set from the empty squares
                var cnt = 0;
                for (var i=0; i<combinedSquares.length; i++) {
                    if (!isFull(this.board, combinedSquares[i])) {
                        cnt++;
                        makeFull(this.board, this.h, this.w, combinedSquares[i]);
                    }
                }
                set_cells = this.shuffle(set_cells);
                for (var i=0; i<cnt; i++) {
                    makeFull(this.board, this.h, this.w, set_cells[i]);
                }
            } else {
                if (nfullList == nempty && nempty>0) {
                    // Put a mine in each empty square in perturbing set and remove one from the first 'nempty' squares in the list
                    for (var i=0; i<set_cells.length; i++) {
                        if (!isFull(this.board, set_cells[i])) {
                            makeFull(this.board, this.h, this.w, set_cells[i]);
                        }
                    }
                    for (var i=0; i<combinedSquares.length; i++) {
                        if (isFull(this.board, combinedSquares[i])) {
                            makeEmpty(this.board, this.h, this.w, combinedSquares[i]);
                            nempty--;
                            if (nempty==0) break;
                        }
                    }
                } else {
                    // Remove a mine from each full square in perturbing set and add one to the first 'nfull' squares in the list.
                    for (var i=0; i<set_cells.length; i++) {
                        if (isFull(this.board, set_cells[i])) {
                            makeEmpty(this.board, this.h, this.w, set_cells[i]);
                        }
                    }
                    for (var i=0; i<combinedSquares.length; i++) {
                        if (!isFull(this.board, combinedSquares[i])) {
                            makeFull(this.board, this.h, this.w, combinedSquares[i]);
                            nfull--;
                            if (nfull==0) break;
                        }
                    }
                }
            }
        },
        
        shuffle: function(a) {
            // http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript
            var j, x, i;
            for (i = a.length; i; i -= 1) {
                j = Math.floor(Math.random() * i);
                x = a[i - 1];
                a[i - 1] = a[j];
                a[j] = x;
            }
            return a
        },
        
        draw: function() {
            // draw board
            this.c = $('c').getContext('2d');
            this.c.font = "12px Arial"
            for (var i=0; i<this.h; i++) {
                for (var j=0; j<this.w; j++) {
                    this.drawSquare("#ccc", j, i);
                }
            }
            
            for (var i=0; i<this.h; i++) {
                for (var j=0; j<this.w; j++) {
                    // -1 = unknown, 0 = clear, 1 = mine
                    if (this.boardKnowledge[i][j] == -1) { //unknown
                        this.drawButton("#fff", "#ccc", "#888", j, i);
                    } else if (this.boardKnowledge[i][j] == 0) {
                        if (this.colorRestriction == 0 && this.showNumbers && this.board[i][j] > 0) {
                            this.drawNumber(this.board[i][j], this.defaultColors[this.board[i][j]], j, i);
                        } else if (this.colorRestriction == 0 && !this.showNumbers) {
                            this.drawSquare(this.defaultColors[this.board[i][j]], j, i);
                        } else if (this.colorRestriction == 1) {
                            this.drawSquare(this.colors[this.secretColors[this.board[i][j]]], j, i);
                        } else if (this.colorRestriction == 2) {
                            this.drawSquare(this.defaultColors[0], j, i);
                        }
                    } else if (this.boardKnowledge[i][j] == 1) {
                        this.drawFlag(j, i);
                    }
                }
            }
        },
        
        drawEmpty: function() {
            this.c = $('c').getContext('2d');
            for (var i=0; i<this.h; i++) {
                for (var j=0; j<this.w; j++) {
                    this.drawButton("#fff", "#ccc", "#888", j, i);
                }
            }
        },

        drawSquare: function(color, rawX, rawY) {
            var x = rawX * this.cellSize, y = rawY * this.cellSize;
            this.c.strokeStyle = "#000";
            this.c.fillStyle = color;
            this.c.beginPath();
            this.c.moveTo(x, y);
            this.c.lineTo(x + this.cellSize, y);
            this.c.lineTo(x + this.cellSize, y + this.cellSize);
            this.c.lineTo(x, y + this.cellSize);
            this.c.closePath();
            this.c.fill();
            this.c.stroke();
        },
        
        drawNumber: function(num, color, rawX, rawY) {
            var x = rawX * this.cellSize, y = rawY * this.cellSize;
            this.c.font = "Bold " + Math.floor(this.cellSize * 0.8) + "px Arial";
            this.c.fillStyle = color;
            this.c.textAlign = "center";
            this.c.fillText("" + num, x + this.cellSize * 0.5, y + this.cellSize * 0.8);
        },
 
        drawButton: function(color1, color2, color3, rawX, rawY) {
            var x = rawX * this.cellSize, y = rawY * this.cellSize;
            var smallSize = this.cellSize / 8;
            this.c.strokeStyle = "#000";
            this.c.fillStyle = color2;
            this.c.beginPath();
            this.c.moveTo(x, y);
            this.c.lineTo(x + this.cellSize, y);
            this.c.lineTo(x + this.cellSize, y + this.cellSize);
            this.c.lineTo(x, y + this.cellSize);
            this.c.closePath();
            this.c.fill();
            this.c.fillStyle = color1;
            this.c.beginPath();
            this.c.moveTo(x, y);
            this.c.lineTo(x + this.cellSize, y);
            this.c.lineTo(x + this.cellSize - smallSize, y + smallSize);
            this.c.lineTo(x + smallSize, y + smallSize);
            this.c.lineTo(x + smallSize, y + this.cellSize - smallSize);
            this.c.lineTo(x, y + this.cellSize);
            this.c.closePath();
            this.c.fill();
            this.c.fillStyle = color3;
            this.c.beginPath();
            this.c.moveTo(x + this.cellSize, y + this.cellSize);
            this.c.lineTo(x + this.cellSize, y);
            this.c.lineTo(x + this.cellSize - smallSize, y + smallSize);
            this.c.lineTo(x + this.cellSize - smallSize, y + this.cellSize - smallSize);
            this.c.lineTo(x + smallSize, y + this.cellSize - smallSize);
            this.c.lineTo(x, y + this.cellSize);
            this.c.closePath();
            this.c.fill();
        },
        
        drawFlag: function(rawX, rawY) {
            // TODO
            var x = rawX * this.cellSize, y = rawY * this.cellSize;
            var smallSize = this.cellSize / 3;
            this.c.strokeStyle = "#f00";
            this.c.fillStyle = "#f00";
            this.c.beginPath();
            this.c.moveTo(x + smallSize, y + smallSize);
            this.c.lineTo(x + 2 * smallSize, y + smallSize);
            this.c.lineTo(x + 2 * smallSize, y + 2 * smallSize);
            this.c.lineTo(x + smallSize, y + 2 * smallSize);
            this.c.closePath();
            this.c.stroke();
            this.c.fill();
        },
        
        execDialog: function (tabName) {
            this.playing = false;
            clearInterval(this.timerInterval);
            this.drawEmpty();
            this.changeDialogTab(tabName);
            this.dialogShowed = true;
        },
        
        changeDialogTab: function (tabName) {
            this.statsTabVisible = false;
            this.settingsTabVisible = false;

            if (tabName === 'stats') {
                this.statsTabVisible = true;
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
            if (!this.playing) {
                this.initGame();
                this.nextLevel(-1, -1);
            }
        },
        
        updatePB: function() {
            this.personalBests.push([this.level, this.finalTime]);
            console.log(this.personalBests);
            this.personalBests = this.personalBests.sort(
                function(a,b) {
                    if (a[0] == b[0]) return a[1] - b[1]; 
                    return b[0] - a[0]; // higher rank is better
                }
            );
            this.personalBests = this.personalBests.slice(0, 5);
            console.log(this.personalBests);
            localStorage.setItem(
                PB_KEY,
                JSON.stringify(this.personalBests),
            );
        }
    }
});
