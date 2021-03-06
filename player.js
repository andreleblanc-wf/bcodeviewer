$(function () {

    var MINE_NEUTRAL = 0x6c6c6c;
    var MINE_A = 0xFF6666;
    var MINE_B = 0x6666FF;
    var FRAME_DURATION = 1000;

    // Temporary variables to avoid
    // constant allocation;
    var bk, i, sprite, bot, sel, delta;
    var mine, gx, gy, px, py;

    var teamPowerMax, teamPower, teamPowerInner, teamPowerPct;

    var ax, ay, av, ak;

    var deltaEvent, stateCallback;

    var statsCounts, statsTeam, statsPanelHQ;
    var researchMax;
    var projectileX, projectileY;

    var fogBotIdx;

    var val, color, wins;
    var pos;
    var panel;
    var parts;

    var hbs;

    var selectedBotHPPct;

    var lines, attackingStr;
    var src, dest;
    var applyIter, undoIter;
    var currentRound, maxRound;

    var visionTmpMinY, visionTmpMaxY;
    var visionMinY, visionMaxY, visionMinX, visionMaxX;
    var visX, visY;

    var hat;

    /**
     * Creates the BattleCode Game Viewer.
     *
     * @param {Object} container - an element to serve as the container for the player
     * @constructor
     */

    var Player = function (container, options) {

        console.log('pixelratio', window.devicePixelRatio);
        /**
         * The container for the entire player
         * @member {jQuery} container
         */
        this.container = $(container);
        this.container.empty();

        /**
         * The team (a or b) whose vision is displayed.
         *
         * @member {String} visionTeam
         */
        this.visionTeam = null;

        /**
         * have the textures loaded yet?
         * @member {boolean} assetsLoaded
         */
        this.assetsLoaded = false;

        /**
         * a Game object to play.
         * @member {Game} game
         */
        this.game = null;

        /**
         * Is playback paused?
         * @member {boolean} paused
         */
        this.paused = true;

        /**
         * time in MS that each round should last
         * @member {Number} frameDuration
         * */
        this.frameDuration = FRAME_DURATION;

        /**
         * a div within container to hold the canvas.
         * @member {jQuery} canvasContainer
         */
        this.canvasContainer = $("<div id='canvasContainer'></div>");

        /**
         * the top level rendering container.
         * @member {PIXI.Container} stage;
         */
        this.stage = new PIXI.Container();

        /**
         * the layer which mines are drawn on.
         * @member {PIXI.Graphics} field
         */
        this.field = new PIXI.Graphics();

        /**
         * the layer which all robots are drawn on.
         * @member {PIXI.Container} botLayer
         */
        this.botLayer = new PIXI.Container();

        /**
         * the layer which artillery fire, explosions,
         * and shield/medbay 'auras' are drawn on
         * @member {PIXI.Graphics} effectsLayer
         */
        this.effectsLayer = new PIXI.Graphics();

        /**
         * the layer which health and action bars are drawn on
         *
         * @member {PIXI.Graphics} statusLayer
         */
        this.statusLayer = new PIXI.Graphics();

        /**
         * the fog layer.
         * @member {PIXI.Grapics} fogLayer;
         */
        this.fogLayer = new PIXI.Graphics();

        /**
         * the PIXI renderer
         * @member {*|WebGLRenderer|CanvasRenderer} renderer
         */
        this.renderer = PIXI.autoDetectRenderer(
            $(this.canvasContainer).width(),
            $(this.canvasContainer).height(),
            {antialias: false, transparent: true, autoResize: true, resolution: window.devicePixelRatio});

        /**
         * the PIXI InteractionManager
         * @member {PIXI.interaction.InteractionManager} renderer
         */
        this.interactionManager = new PIXI.interaction.InteractionManager(
            this.renderer, {autoPreventDefault: true});

        /**
         * a div created by the player to contain detail panels
         * for each team and the selected robot.
         * @type {jQuery} statsPanel
         */
        this.statsPanel = null;

        this.stage.addChild(this.field);
        this.stage.addChild(this.botLayer);
        this.stage.addChild(this.statusLayer);
        this.stage.addChild(this.effectsLayer);
        this.stage.addChild(this.fogLayer);

        this.canvasContainer.append(this.renderer.view);
        $(window).on('resize', '', this.onResize.bind(this));

        this.loadAssets();
    };


    /**
     * Called when assets are fully loaded
     *
     * @param {PIXI.Loader} loader - the PIXI Asset loader
     * @param {Object} resources - the loaded resources
     */
    Player.prototype.onAssetsLoaded = function (loader, resources) {

        // setup the hat textures
        this.hatTextures = [];
        for (var i=0; i<=2; i++) {
            this.hatTextures.push(new PIXI.Texture(resources['hat-' + i].texture));
        }

        // initialize the exposion animation texture-array;
        this.boomFrames = [];
        var texture = resources.boom.texture;
        var frameWidth = 60, frameHeight = 60;
        for(var i = 0; i < texture.width-frameWidth; i+=frameWidth) {
            this.boomFrames.push({texture: new PIXI.Texture(texture.baseTexture, new PIXI.Rectangle(i, 0, frameWidth, frameHeight)), time: 1});
        }
        var rev = [];
        for(var i = 0; i < texture.width-frameWidth; i+=frameWidth) {
            rev.push({texture: new PIXI.Texture(texture.baseTexture, new PIXI.Rectangle(i, 0, frameWidth, frameHeight)), time: 1});
        }
        rev.reverse();
        this.boomFrames = this.boomFrames.concat(rev);

        // initialize this.textures with all bot textures.
        for (var t in {a: true, b: true}) {
            for (var rt in {soldier: true, hq: true, artillery: true, medbay: true, shields: true, supplier: true, generator: true}) {
                this.textures[t][rt] = new PIXI.Texture(resources[rt + '-' + t].texture);
            }
        }

        this.assetsLoaded = true;

        this.container.append(this.buildHeader());
        this.container.append(this.canvasContainer);
        requestAnimationFrame( this.animate.bind(this) );
    };


    /**
     * Pre-loads all textures needed by the viewer and calls
     * onAssetsLoaded when complete
     */
    Player.prototype.loadAssets = function () {
        PIXI.loader
            .add("boom", "img/boom.png")
            .add("hq-a", "img/hq-a.png")
            .add("hq-b", "img/hq-b.png")
            .add("soldier-a", "img/soldier-a.png")
            .add("soldier-b", "img/soldier-b.png")
            .add("supplier-a", "img/supplier-a.png")
            .add("supplier-b", "img/supplier-b.png")
            .add("generator-a", "img/generator-a.png")
            .add("generator-b", "img/generator-b.png")
            .add("artillery-a", "img/artillery-a.png")
            .add("artillery-b", "img/artillery-b.png")
            .add("medbay-a", "img/medbay-a.png")
            .add("medbay-b", "img/medbay-b.png")
            .add("shields-a", "img/shields-a.png")
            .add("shields-b", "img/shields-b.png")
            .add("hat-0", "img/hats/0.png")
            .add("hat-1", "img/hats/1.png")
            .add("hat-2", "img/hats/2.png")
            .load(this.onAssetsLoaded.bind(this));
    };


    /**
     * called when the window is resized.
     */
    Player.prototype.onResize = function () {
        console.log("Container resized!");
        var newW = $(this.canvasContainer).width();
        var newH = $(this.canvasContainer).height() - 1;
        if (this.renderer && this.renderer.view) {
            console.log("Resizing renderer to " + newW + "x" + newH);
            $(this.renderer.view).width(newW + "px");
            $(this.renderer.view).height(newH + "px");
            this.renderer.resize(newW, newH);
            this.setDimensions();
        }
    };


    /**
     * called when a new match is selected from the dropdown
     *
     * @param {Object} ev - change event
     */
    Player.prototype.onMatchSelectorChange = function (ev) {
        var val = $(ev.currentTarget).val();
        console.log("Match: val");
        if (!this.paused) {
            this.togglePlayback();
        }
        this.initMatch(this.game.matches[val]);
    };


    /**
     * called when the 'Go to first round' button is clicked
     *
     * @param {Object} ev - click event
     */
    Player.prototype.onGotoStartButton = function (ev) {
        this.transitionToRound(0);
    };


    /**
     * called when the 'Go to last round' button is clicked
     *
     * @param {Object} ev - click event
     */
    Player.prototype.onGotoEndButton = function (ev) {
        this.transitionToRound(this.match.states.length-1);
    };


    /**
     * called when the 'Go to next round' button is clicked
     *
     * @param {Object} ev - click event
     */
    Player.prototype.onGoForwardButton = function (ev) {
        this.transitionToRound(Math.min(this.round + 1, this.match.states.length-1));
    };


    /**
     * called when the 'Go to previous round' button is clicked
     *
     * @param {Object} ev - click event
     */
    Player.prototype.onGoBackButton = function (ev) {
        this.transitionToRound(Math.max(this.round - 1, 0));
    };


    /**
     * called when the 'fullscreen' button is clicked
     *
     * @param {Object} ev - click event
     */
    Player.prototype.onFullscreenButton = function (e) {
        if (Util.isFullscreen()) {
            Util.cancelFullscreen();
        } else {
            Util.makeFullscreen($('body'));
        }
    };

    /**
     * called when the round slider is moved.
     *
     * @param {Object} e - change event
     */
    Player.prototype.onTimeSliderChange = function (e) {
        this.transitionToRound($(e.currentTarget).val());
    };

    /**
     * called when the pseed slider is moved.
     *
     * @param {Object} e - change event
     */
    Player.prototype.onSpeedSliderChange = function (e) {

        var pct = this.speedSlider.val();
        this.frameDuration = (0.106122 * pct * pct) - (20.7184*pct) + 1020.61;
        this.speedIndicator.text(this.speedSlider.val() + "%");
        for (i=0; i<this.boomFrames.length; i++) {
            this.boomFrames[i].time = this.frameDuration*2 / this.boomFrames.length;
        }
    };


    /**
     * Called when the 'vision' dropdown is changed.
     * @param {Object} ev - Change Event
     */
    Player.prototype.onVisionSelectorChange = function (ev) {
        this.visionTeam = this.visionSelector.val();
        this.renderFog();
    };

    /**
     * called when the user clicks on a robot.
     *
     * @param {PIXI.interaction.InteractionData} ev - click data
     */
    Player.prototype.onBotClick = function (ev) {
        bot = ev.target;
        if (bot.selectedBot != bot.id) {
            this.selectBot(bot.id);

        }
    };


    /**
     * Set the selected bot by id
     *
     * @param {Number} botId - the bot id to select
     */
    Player.prototype.selectBot = function (botId) {
        bot = this.matchState.robots[botId];
        this.selectedBot = bot.id;
        $('.botIcon', this.selectedBotPanel)
            .empty()
            .append("<div class='energonOuter'><div class='energon'></div></div>");
        $('.selectedBotStats').show();
        this.updateSelectedBotPanel();
    };


    /**
     * Position the stats panel over the unused area of the canvas.
     */
    Player.prototype.positionStatsPanel = function () {
        var bottomSpace = $(this.canvasContainer).height() - this.boardHeight;
        var rightSpace = $(this.canvasContainer).width() - this.boardWidth;

        if (bottomSpace > rightSpace) {
            console.log("Stats At Bottom!");
            this.statsHorizontal = true;
            this.statsVertical = false;
            this.statsPanel.removeClass("vertical").addClass("horizontal");
            var top = this.canvasContainer.offset().top + this.boardHeight;
            this.statsPanel.css({
                'boxSizing': 'border-box',
                left: 0 + "px",
                top: top,
                width: this.boardWidth,
                height: this.canvasContainer.height() - this.boardHeight,
                flexDirection: 'row'
            });
        } else {
            this.statsHorizontal = false;
            this.statsVertical = true;
            this.statsPanel.removeClass("horizontal").addClass("vertical");
            console.log("Stats At Side!");
            this.statsPanel.css({
                'boxSizing': 'border-box',
                left: this.canvasContainer.offset().left + this.boardWidth,
                top: this.canvasContainer.offset().top,
                //width: this.canvasContainer.width() - this.boardWidth,
                height: this.boardHeight,
                flexDirection: 'column'
            });

        }
    };


    /**
     * sets the size of game objects based on available screen size.
     */
    Player.prototype.setDimensions = function () {
        if (this.match) {
            var wPix = (this.canvasContainer.width() / this.match.mapWidth);
            var hPix = (this.canvasContainer.height() / this.match.mapHeight);

            this.cellSize = Math.min(wPix, hPix);
            this.boardWidth = (this.cellSize * this.match.mapWidth);
            this.boardHeight = (this.cellSize * this.match.mapHeight);

            var bottomSpace = $(this.canvasContainer).height() - this.boardHeight;
            var rightSpace = $(this.canvasContainer).width() - this.boardWidth;

            if (bottomSpace > rightSpace) {
                while (bottomSpace < 160) {
                    this.cellSize -= 0.25;
                    this.boardWidth = (this.cellSize * this.match.mapWidth);
                    this.boardHeight = (this.cellSize * this.match.mapHeight);
                    bottomSpace = $(this.canvasContainer).height() - this.boardHeight;
                }
            } else {
                while (rightSpace < 250) {
                    this.cellSize -= 0.25;
                    this.boardWidth = (this.cellSize * this.match.mapWidth);
                    this.boardHeight = (this.cellSize * this.match.mapHeight);
                    rightSpace = $(this.canvasContainer).width() - this.boardWidth;
                }
            }

            this.botSize = this.cellSize;
            this.halfBotSize = this.botSize / 2;
        }
        if (this.matchState) {
            sprite, bot;
            for (bk in this.matchState.robots) {
                bot = this.matchState.robots[bk];
                sprite = this.botSprites[bk];
                if (bot.type == 'hq') {
                    sprite.width = this.botSize * 1.5;
                    sprite.height = this.botSize * 1.5;
                } else {
                    sprite.width = this.botSize;
                    sprite.height = this.botSize;
                }

                TweenLite.killTweensOf(sprite.position);
                pos = this.getCellCenter(bot.pos);
                sprite.position.x = pos.x;
                sprite.position.y = pos.y;
            }
        } if (this.statsPanel) {
            this.positionStatsPanel();
        }

        this.renderMap();
        this.renderFog();
        console.log("Initialized " + this.boardWidth + "x" + this.boardHeight +
                    " canvas and " + this.cellSize + "px cell size");
    };


    /**
     * Called when the Game fails to load
     *
     * Shows an error message in the loading dialog.
     */
    Player.prototype.onGameLoadError = function (err) {
        console.error(err.error);
        $(".loadMessage", this.loadDialog).addClass("error").text("ERROR: " + err.message);
        $('progress', this.loadDialog).remove();
        var retryButton = $("<button class='reload'>Back</button>");
        this.loadDialog.append(retryButton);
        retryButton.on('click', function () { location.reload() }).focus();
    };


    /**
     * Called when the Game begins loading.
     *
     * Shows a Loading dialog.
     */
    Player.prototype.onGameLoadStart = function () {
        this.loadDialog = $("<div id='loadDialog'><div class='logo'></div><div class='loadMessage'>Loading game...</div><progress></progress></div>");
        $('progress', this.loadDialog).attr("max", 100);
        $('progress', this.loadDialog).attr("value", 0);
        this.loadDialog.css({
            position: 'absolute',
            top: '45%',
            left: '30%',
            width: '40%'
        });
        $('body').append(this.loadDialog);
    };


    /**
     * Called throughout the Game loading process.
     *
     * @param {Number} progress - loading progress (0-100)
     */
    Player.prototype.onGameLoadProgress = function (progress) {
        setTimeout(function () {
            $("progress", this.loadDialog).attr("value", Math.floor(progress));
        }.bind(this), 1);
    };

    
    /**
     * Finds all squares visible by the given team.
     * 
     * @param {String} team 
     * @returns {Object} - keys are integer-locations, values are true.
     */
    Player.prototype.calculateFog = function (team) {
        if (this.matchState) {
            var visibleCells = {};
            var visionRadius = 3;
            if (this.matchState.hasVision(team)) {
                visionRadius = 5;
            }

            for (bk in this.matchState.robots) {
                bot = this.matchState.robots[bk];
                if (bot.team == team) {
                    fogBotIdx = (this.match.mapWidth * bot.pos.y) + bot.pos.x;
                    $.extend(visibleCells, this.getVisibleCells(bot.pos, visionRadius));
                }
            }
            return visibleCells;
        }
        return {};
    };


    /**
     * finds all squares visible from the given position
     * within the given radius. (not squared.)
     * 
     * @param pos
     * @param {Number} radius - Only 3 and 5 are supported. 
     * @returns {Object} - keys are integer locations.
     */
    Player.prototype.getVisibleCells = function (pos, radius) {
        var results = {};
        var visionMinX = Math.max(0, pos.x - radius);
        var visionMaxX = Math.min(this.match.mapWidth-1, pos.x + radius);
        var visionMinY = Math.max(0, pos.y - radius);
        var visionMaxY = Math.min(this.match.mapHeight-1, pos.y + radius);
        var visionTmpMinY, visionTmpMaxY;
        if (radius == 3) {
            for (visX = visionMinX; visX <= visionMaxX; visX++) {
                if (visX == pos.x - radius || visX == pos.x + radius) {
                    visionTmpMinY = pos.y - radius + 1;
                    visionTmpMaxY = pos.y + radius - 1;
                } else {
                    visionTmpMinY= visionMinY;
                    visionTmpMaxY = visionMaxY;
                }
                for (visY = visionTmpMinY; visY <= visionTmpMaxY; visY++) {
                    results[(visY * this.match.mapWidth) + visX] = true;
                }
            }
            return results;
        } else {
            for (visX = visionMinX; visX <= visionMaxX; visX++) {
                if (visX == pos.x - radius || visX == pos.x + radius) {
                    visionTmpMinY = pos.y - radius + 3;
                    visionTmpMaxY = pos.y + radius - 3;
                } else if (visX < (pos.x - radius) + 3 || visX > pos.x + radius - 3) {
                    visionTmpMinY = pos.y - radius + 1;
                    visionTmpMaxY = pos.y + radius - 1;
                } else {
                    visionTmpMinY = visionMinY;
                    visionTmpMaxY = visionMaxY;
                }
                for (visY = visionTmpMinY; visY <= visionTmpMaxY; visY++) {
                    results[(visY * this.match.mapWidth) + visX] = true;
                }
            }
            return results;
        }
    };

    /**
     * Called when the Game is fully loaded and parsed.
     */
    Player.prototype.onGameLoadComplete = function () {

        if (this.loadDialog) {
            this.loadDialog.remove();
        }

        this.matchSelector.empty();
        for (i=0; i<this.game.matches.length; i++) {
            var mapName = this.game.matches[i].mapName;
            if (mapName.substring(mapName.length-4).toLowerCase() == '.xml') {
                mapName = mapName.substring(0, mapName.length-4);
            }
            this.matchSelector.append("<option value='" + i + "'>" + i + ". " + mapName + "</option>");
        }

        this.visionSelector.empty();
        this.visionSelector.append($("<option value=''>-Vision-</option>"));
        this.visionSelector.append($("<option value='a'>" + this.game.teams.a.name + "</option>"));
        this.visionSelector.append($("<option value='b'>" + this.game.teams.b.name + "</option>"));

        this.initMatch(this.game.matches[0]);
    };


    /**
     * sets the Game to be played.
     *
     * @param {Game} game - a Game
     * @param {function} callback - a function to call when loading is complete.
     */
    Player.prototype.loadGame = function (game, callback) {

        if (!this.paused) {
            console.log("Toggling");
            this.togglePlayback();
            this.transitionToRound(0);
        }

        if (typeof game == 'string') {
            this.game = new Game();
            this.game.load(game);
        } else {
            this.game = game;
        }
        if (!game.isLoaded) {
            this.game.on('loadStart', this.onGameLoadStart.bind(this));
            this.game.on('loadProgress', this.onGameLoadProgress.bind(this));
            this.game.on('loadComplete', this.onGameLoadComplete.bind(this));
            this.game.on('loadError', this.onGameLoadError.bind(this));
            $('div.loadMessage', this.loadDialog).html("<span class='errorMessage'></span>");
        } else {
            this.onGameLoadComplete();
        }
    };


    /**
     * Intialize the player for the selected match
     * (resizes the game board and stats panel)
     *
     * @param {Match} match - the match
     */
    Player.prototype.initMatch = function (match) {
        this.match = match;
        this.reset();
        $(window).resize();
        this.renderMap();
        this.timeSlider.val(0);
        this.timeSlider.attr("max", this.match.states.length-1);
        this.transitionToRound(0);
    };

    /**
     * Renders a batch of mines using the current line/fill style.
     *
     * @param {Object} mines - keys are integers mapping to locations, values are 'true'
     */
    Player.prototype.renderMineList = function (mines) {

        for (mine in mines) {
            gx = mine % this.match.mapWidth;
            gy = Math.floor(mine / this.match.mapWidth);
            px = 1+(this.cellSize * gx);
            py = 1+(this.cellSize* gy);
            this.field.drawRect(px, py, this.cellSize-2, this.cellSize-2);
        }
    };


    /**
     * Builds a 'Team Stats Panel' for the given team.
     * this is a div containing power levels, bot counts and upgrade progress.
     *
     * @param {String} team - 'a' or 'b'
     * @returns {jQuery}
     */
    Player.prototype.buildTeamStatsPanel = function (team) {
        var teamInfo = this.game.teams[team];
        var $panel = $("<div class='teamStatsPanel' id='team-stats-"+team+"'></div>");
        $panel.append($("<h1 class='team-" + team + "'>" + teamInfo.name + "</h1>"));

        var tbl = $("<table class='teamStats'></table>");
        var row1 = $('<tr>' +
                '<td rowspan="3" class="hqCell"></td>' +
                '<th class="soldier"></th>' +
                '<td class="soldier">0</td>' +
                '<th class="medbay"></th>' +
                '<td class="medbay">0</td>' +
                '<th class="shields"></th>' +
                '<td class="shields">0</td>' +
            '</tr>');
        var row2 = $('<tr>' +
                '<th class="supplier"></th>' +
                '<td class="supplier">0</td>' +
                '<th class="generator"></th>' +
                '<td class="generator">0</td>' +
                '<th class="artillery"></th>' +
                '<td class="artillery">0</td>' +
            '</tr>');
        var row3 = $('<tr>' +
            '<td colspan="6" class="teamPower"></td>' +
            '</tr>');
        var row4 = $('<tr class="upgradesRow" style="display: none">' +
            '<td colspan="7" class="upgrades"></td>' +
            '</tr>');
        var row5 = $("<tr class='starsRow' style='display: none'><td colspan='7' class='stars'></td></tr>");

        tbl.append(row1);
        tbl.append(row2);
        tbl.append(row3);
        tbl.append(row4);
        tbl.append(row5);
        var hqIcon = $("<div class='hqIcon team-" + team + "'></div>");
        var hqEnergon = $("<div class='energonOuter'><div class='energon'></div></div>");
        hqIcon.append(hqEnergon);
        $('td.hqCell', tbl).append(hqIcon);
        var progressBar = $("<span class='power-value'>0</span><div class='teamPowerWrapper'><div class='teamPower'></div></div>");
        $('td.teamPower', tbl).append(progressBar);
        $panel.append(tbl);

        for (var u in this.upgrades) {
            $('td', row4).append($('<div title="' + u + '" style="display: none" class="upgrade '+ u + '">' +
                    '<progress value="0" max="' + this.upgrades[u] + '"></progress>' +
            '</div>'));
        }

        return $panel;
    };


    /**
     * Builds the 'Selected Bot Panel' where details on the
     * selected bot are displayed.
     *
     * @returns {jQuery}
     */
    Player.prototype.buildSelectedBotPanel = function () {
        this.selectedBotPanel = $(
            "<div id='selectedBotPanel'>" +
                "<h1>no robot selected</h1>" +
                "<table class='selectedBotStats' style='display:none;'>" +
                    "<tr><td rowspan='3'><div class='botIcon'></div></td><th title='Energon' class='energon'><i  title='Energon' class='fa fa-heartbeat'></i></th><td  title='Energon' class='energon'></td><th title='Shields' class='shields'><i title='Shields' class='fa fa-shield'></i></th><td title='Shields' class='shields'></td></tr>" +
                    "<tr><th class='position' title='Position' ><i title='position' class='fa fa-compass'></i></th><td title='position' class='position'></td><th title='Bytecodes Used' class='bytecodes'><i title='Bytecodes Used' class='fa fa-clock-o'></i></th><td title='Bytecodes Used' class='bytecodes'>0</td></tr>" +
                    "<tr><td colspan='4' class='action'><span class='action-text'>Idle</span><div class='actionProgressWrapper'><div class='actionProgress'></div></div></td></tr>" +
                "</table>" +
                "<div class='indicatorStrings'></div>" +
            "</div>");
        return this.selectedBotPanel;
    };


    /**
     * Builds the Player's header where are all controls reside.
     *
     * @returns {jQuery}
     */
    Player.prototype.buildHeader = function () {
        this.header = $("<div id='header'></div>");
        this.logo = $("<img id='logo' src='img/blitzcode.png' />");
        this.matchSelector = $("<select id='matchSelector'></select>");
        this.roundIndicator = $("<div id='roundIndicator'>0/0</div>");
        this.timeSlider = $("<input id='timeSlider' type='range' max='1' value='0' />");
        this.speedSlider = $("<input title='Playback Speed' id='speedSlider' type='range' min='1' max='99' value='70' />");
        this.playPauseButton = $("<button title='Play/Pause' id='playPauseButton' class='paused'><i class='fa fa-play'></i></button>");
        this.gotoEndButton = $("<button title='Go to last round' id='gotoEndButton'><i class='fa fa-fast-forward'></i></button>");
        this.gotoStartButton = $("<button title='Go to first round' id='gotoStartButton'><i class='fa fa-fast-backward'></i></button>");
        this.goForwardButton = $("<button title='Go to next round' id='goForwardButton'><i class='fa fa-forward'></i></button>");
        this.goBackButton = $("<button  title='Go to previous round' id='goBackButton'><i class='fa fa-backward'></i></button>");
        this.speedIndicator= $("<div id='speedIndicator'>75%</div>");
        this.fullscreenButton = $("<button title='Toggle Fullscreen' id='fullscreenButton'><i class='fa fa-arrows-alt'></i></button>");
        this.visionSelector = $("<select id='visionSelector'>" +
            "<option value=''>-Vision-</option>" +
            "<option value='a' style='color: #FF0000'>Team A</option>" +
            "<option value='b' style='color: #FF0000'>Team B</option>" +

        "</select>");

        this.timeSlider.on('change input', '', this.onTimeSliderChange.bind(this));
        this.gotoStartButton.on('click', this.onGotoStartButton.bind(this));
        this.gotoEndButton.on('click', this.onGotoEndButton.bind(this));
        this.goBackButton.on('click', this.onGoBackButton.bind(this));
        this.goForwardButton.on('click', this.onGoForwardButton.bind(this));
        this.fullscreenButton.on('click', this.onFullscreenButton.bind(this));
        this.visionSelector.on('change', this.onVisionSelectorChange.bind(this));
        this.matchSelector.on('change', '', this.onMatchSelectorChange.bind(this));
        this.speedSlider.on('change input', '', this.onSpeedSliderChange.bind(this));
        this.playPauseButton.on('click', '', this.togglePlayback.bind(this));

        this.header.append(this.logo);
        this.header.append(this.matchSelector);
        this.header.append(this.gotoStartButton);
        this.header.append(this.goBackButton);
        this.header.append(this.playPauseButton);
        this.header.append(this.goForwardButton);
        this.header.append(this.gotoEndButton);
        this.header.append(this.timeSlider);
        this.header.append(this.roundIndicator);
        this.header.append(this.speedSlider);
        this.header.append(this.speedIndicator);
        this.header.append(this.visionSelector);
        this.header.append(this.fullscreenButton);

        this.speedSlider.change();

        return this.header;
    };

    /**
     * Builds the 'Stats Panel' - a container for the
     * 'Selected Bot Panel' and 'Team Stats Panels'
     *
     * Unlike the build* functions this one appends it to the DOM as well.
     */
    Player.prototype.initializeStatsPanel = function () {
        $("#statsPanel").remove();
        this.statsPanel = $("<div id='statsPanel'></div>");
        this.statsPanel.css({position: 'absolute', display: 'flex'});
        $('body').append(this.statsPanel);
        this.statsPanel.append(this.buildTeamStatsPanel('a'));
        this.statsPanel.append(this.buildTeamStatsPanel('b'));
        this.statsPanel.append(this.buildSelectedBotPanel());
    };


    /**
     * Reset the player
     *
     * ugh.
     */
    Player.prototype.reset = function () {
        this.initializeStatsPanel();
        this.botSprites = {};
        this.hatSprites = {};
        this.selectedBot = null;
        this.matchState = null;
        this.frameTime = 0;
        this.round = -1;
        this.lastElapsed = 0;
        this.playbackComplete = false;
        this.paused = true;
        this.botSprites = {};
        this.botLayer.removeChildren();
    };


    /**
     * toggle play/pause state.
     */
    Player.prototype.togglePlayback = function () {
        if (!this.assetsLoaded) {
            // TODO: They pressed play before
            // textures were loaded.
            return;
        }
        this.paused = !this.paused;
        $("i.fa", this.playPauseButton)
            .removeClass('fa-play fa-pause')
            .addClass(this.paused ? 'fa-play' : 'fa-pause');
    };


    /**
     * Convert a string location of the format 'x,y' to an integer
     * representing the index of that location in a 1-dimensional array.
     *
     * @param {String} locStr - a location (eg. 10,2)
     * @returns {Number}
     */
    Player.prototype.parseLoc = function (locStr) {
        parts = locStr.split(",");
        return (this.match.mapWidth * parts[0]) + parts[1];
    };


    /**
     * Transition from the current round to the given round.
     *
     * This is called after a round has played
     * for {@link Player#frameDuration} ms or when
     * the round is changed manually.
     *
     * @param {Number} round - the desired round
     */
    Player.prototype.transitionToRound = function (round) {
        if (round > this.match.states.length-1) {
            return;
        }
        this.effectsLayer.clear();
        currentRound = this.round;

        if (round == currentRound) {
            //TODO: No-op?
        } else if (round > currentRound) {
            // Go Forward.
            for (applyIter=currentRound+1; applyIter<=round; applyIter++) {
                //console.log("Applying state " + this.round + " -> " + i);
                this.round = applyIter;
                this.matchState = this.match.states[this.round];
                this.applyMatchState(this.matchState, round == applyIter);
            }
        } else {
            // Go backwards.
            for (undoIter=currentRound-1; undoIter>=round; undoIter--) {
                //console.log("Undoing state " + this.round + " -> " + i);
                this.undoMatchState(this.matchState, round == undoIter);
                this.round = undoIter;
                this.matchState = this.match.states[this.round];
            }
        }

        $("#timeSlider").val(this.round);
        maxRound = this.match.states.length-1;
        this.roundIndicator.text(Util.zeroPad(this.round, ("" + maxRound).length) + "/" + maxRound);

        this.updateStatsPanel();
        this.renderMap();
        this.renderFog();
    };


    Player.prototype.renderFog = function () {
        this.fogLayer.clear();
        if (this.visionTeam) {
            this.fogLayer.beginFill(0x000000, 0.666);
            var visibleCells = this.calculateFog(this.visionTeam);
            var gx, gy;
            for (i = 0; i < this.match.mapWidth * this.match.mapHeight; i++) {
                if (!visibleCells[i]) {
                    gx = i % this.match.mapWidth;
                    gy = Math.floor(i / this.match.mapWidth);
                    this.fogLayer.drawRect(gx * this.cellSize, gy * this.cellSize, this.cellSize, this.cellSize);
                }
            }
            this.fogLayer.endFill();
        }
    };

    /**
     * Updates all the values in the Stats Panels
     */
    Player.prototype.updateStatsPanel = function () {
        statsCounts = {a: {hq: 0, soldier: 0, artillery: 0, generator: 0, shields: 0, medbay: 0, supplier: 0},
                       b: {hq: 0, soldier: 0, artillery: 0, generator: 0, shields: 0, medbay: 0, supplier: 0}};

        statsPanelHQ = {a: null, b: null};
        for (bk in this.matchState.robots) {
            bot = this.matchState.robots[bk];
            statsCounts[bot.team][bot.type] ++;
            if (bot.type == 'hq') {
                statsPanelHQ[bot.team] = bot;
            }
        }

        for (statsTeam in {a: true, b: true}) {
            panel = $("#team-stats-" + statsTeam);

            wins = this.match.wins[statsTeam];
            if (this.round == this.match.states.length-1) {
                if (this.match.winner == statsTeam) {
                    wins += 1;
                } else {
                    $(".hqIcon", panel).css({backgroundImage: "url(img/boom.gif)"});
                }
            }
            $("td.stars i", panel).remove();
            $('tr.starsRow', panel).hide();
            for (i=0; i<wins; i++) {
                $('tr.starsRow', panel).show();
                $('td.stars', panel).append("<i class='fa fa-star'></i>");
            }

            for (i in statsCounts[statsTeam]) {
                $("td." + i, panel).text(statsCounts[statsTeam][i]);
            }
            val = ((statsPanelHQ[statsTeam] ? statsPanelHQ[statsTeam].energon : 0) / 500) * 100;
            color = Util.toCSSColor(Math.floor(Util.getHealthColor(val/100)));
            $("div.energon", panel).css({width: val + "%", backgroundColor: color});
            teamPowerInner = $("div.teamPower", panel);
            teamPowerMax = teamPowerInner.data("maxPower") || 100;
            teamPower = Math.floor(this.matchState.power[statsTeam]);
            if (teamPower > teamPowerMax) {
                teamPowerMax = teamPower;
                teamPowerInner.data("maxPower", teamPowerMax);
            }
            teamPowerPct = Math.floor((teamPower/teamPowerMax)*100);
            teamPowerInner.css({width: "" + teamPowerPct + "%"});
            $("span.power-value", panel).text(teamPower);
        }

        this.updateSelectedBotPanel();
    };


    /**
     * Update the 'Selected Bot Panel'
     */
    Player.prototype.updateSelectedBotPanel = function () {
        if (this.selectedBot) {
            bot = this.matchState.robots[this.selectedBot];
            if (bot) {
                $("#selectedBotPanel .botIcon").css({backgroundImage: "url(img/" + bot.type + "-" + bot.team + "-lg.png)", backgroundColor: 'transparent'});
                $('.botIcon .energonOuter', this.selectedBotPanel).show();
                selectedBotHPPct = Math.floor((bot.energon / bot.maxEnergon) * 100);
                color = Util.toCSSColor(Math.floor(Util.getHealthColor(selectedBotHPPct/100)));
                $("#selectedBotPanel div.energon").css({width: selectedBotHPPct + "%", backgroundColor: color});
                $("#selectedBotPanel h1").text("#" + bot.id + "[" + Util.titleCase(bot.type) + "]");
                $("#selectedBotPanel td.energon").text(Math.floor(bot.energon) + "/" + bot.maxEnergon);
                $("#selectedBotPanel td.shields").text(Math.floor(bot.shields));
                $("#selectedBotPanel td.position").text(bot.pos.x + ", " + bot.pos.y);
                $("#selectedBotPanel td.bytecodes").text(bot.bytecodesUsed);

                $(".indicatorStrings", this.selectedBotPanel)
                    .empty()
                    .append("<span>" + bot.indicatorStrings[0] + "</span><br/>")
                    .append("<span>" + bot.indicatorStrings[1] + "</span><br/>")
                    .append("<span>" + bot.indicatorStrings[2] + "</span>");

                var actionStr = 'Idle';

                if (bot.isMoving) {
                    actionStr = 'Moving ' + Util.getDirectionText(bot.dir);
                }


                for (ak in bot.attacking) {
                    ax = ak % this.match.mapWidth;
                    ay = Math.floor(ak / this.match.mapWidth);
                    if (bot.attacking[ak]) {

                        if (actionStr == 'Idle') {
                            actionStr = "Attacking";
                        } else {
                            actionStr += ", Attacking"
                        }

                        if (bot.type == 'artillery') {
                            actionStr += " " + ax + ", " + ay;
                        }
                        break;
                    }
                }


                if (bot.action) {
                    var prog = (bot.actionRoundsTotal-(bot.actionRounds-1));
                    actionStr = this.botActionTexts[bot.action] + " [" + prog + "/" + bot.actionRoundsTotal + "]";
                    $("#selectedBotPanel div.actionProgress").css({width: Math.floor((prog / bot.actionRoundsTotal) * 100) + '%'});
                } else {
                    $("#selectedBotPanel div.actionProgress").css({width: '0%'});
                }

                $("#selectedBotPanel span.action-text").text(actionStr);

                if (bot.isDead) {
                    $('.botIcon', this.selectedBotPanel).css({backgroundColor: "#FF6666"});
                }

            } else {
                $('.botIcon div.energon', this.selectedBotPanel).css({width: "0%"});
                $('.botIcon', this.selectedBotPanel).css({backgroundColor: "#FF6666"});
            }
        }

    };


    /**
     * Called by transitionToRound when it needs to move forward in time.
     *
     * @param {MatchState} state - the MatchState to apply.
     * @param {boolean} animate - whether this transition should be animated or should happen instantly.
     */
    Player.prototype.applyMatchState = function (state, animate) {

        for (i=0; i<state.delta.length; i++) {
            deltaEvent = state.delta[i];
            stateCallback = this['apply_' + deltaEvent.event];
            if (stateCallback) {
                stateCallback.call(this, deltaEvent, animate);
            }
        }
    };


    /**
     * Called by transitionToRound when it needs to move backward in time.
     *
     * @param {MatchState} state - the MatchState to apply.
     * @param {boolean} animate - whether this transition should be animated or should happen instantly.
     */
    Player.prototype.undoMatchState = function (state, animate) {

        for (i=0; i<state.delta.length; i++) {
            deltaEvent = state.delta[i];
            stateCallback = this['undo_' + deltaEvent.event];
            if (stateCallback) {
                stateCallback.call(this, deltaEvent, animate);
            }
        }
    };


    /**
     * callbacks to apply/undo the different game events.
     */

    Player.prototype.apply_spawn = function (ev, animate) {
        bot = new PIXI.Sprite(this.textures[ev.bot.team.toLowerCase()][ev.bot.type.toLowerCase()]);
        bot.id = ev.bot.id;
        bot.interactive = true;
        bot.on('mousedown', this.onBotClick.bind(this));
        bot.anchor.x = 0.5;
        bot.anchor.y = 0.5;
        bot.pivot.x = 0.5;
        bot.pivot.y = 0.5;
        if (ev.bot.type =='hq') {
            bot.width = this.botSize * 1.5;
            bot.height = this.botSize * 1.5;
        } else {
            bot.width = this.botSize;
            bot.height = this.botSize;
        }
        bot.location = ev.bot.pos;
        bot.position = this.getCellCenter(ev.bot.pos);
        bot.rotation = ev.bot.dir;
        this.botSprites[ev.bot.id] = bot;
        this.botLayer.addChild(bot);
    };


    Player.prototype.undo_spawn = function (ev, animate) {
        this.botLayer.removeChild(this.botSprites[ev.bot.id]);
        this.botSprites[ev.bot.id].destroy();
        delete this.botSprites[ev.bot.id];
    };


    Player.prototype.apply_research = function (ev, animate) {
        panel = $("#team-stats-" + ev.team);
        var progressBar = $(".upgrade." + ev.upgrade + " progress", panel);
        researchMax = progressBar.attr("max");
        if (researchMax == ev.value) {
            progressBar.addClass("complete");
        } else if (ev.value == 1) {
            progressBar.parent().show();
            $('tr.upgradesRow', panel).show();
        } else if (ev.upgrade == 'NUKE' && ev.value == 202) {
            $('.NUKE progress', panel).addClass("half");
        }
        progressBar.attr("value", ev.value);
    };


    Player.prototype.undo_research = function (ev, animate) {
        panel = $("#team-stats-" + ev.team);
        var progressBar = $(".upgrade." + ev.upgrade + " progress");
        researchMax = progressBar.attr("max");
        if (researchMax == progressBar.attr("value")) {
            progressBar.removeClass("complete");
        } else if (progressBar.attr("value") == 1) {

            progressBar.parent().hide();
            if ($('div.upgrade:visible', panel).length == 0) {
                $('tr.upgradesRow', panel).hide();
            }
        } else if (ev.upgrade == 'NUKE' && ev.value == 202) {
            $('.NUKE progress', panel).removeClass('half');
        }
        progressBar.attr("value", ev.value-1);
    };


    Player.prototype.apply_regen = Player.prototype.undo_regen = function (ev, animate) {
        if (animate) {
            this.effectsLayer.lineStyle(0, 0);
            this.effectsLayer.beginFill(0x66FF66, 0.5);
            pos = this.getCellCenter(ev.loc);
            this.effectsLayer.drawCircle(pos.x, pos.y, this.cellSize * 1.5);
            this.effectsLayer.endFill();
        }
    };


    Player.prototype.apply_shield = Player.prototype.undo_shield = function (ev, animate) {
        if (animate) {
            this.effectsLayer.lineStyle(0, 0);
            this.effectsLayer.beginFill(0x66FFFF, 0.5);
            pos = this.getCellCenter(ev.loc);
            this.effectsLayer.drawCircle(pos.x, pos.y, this.cellSize * 1.5);
            this.effectsLayer.endFill();
        }
    };


    Player.prototype.apply_attack = Player.prototype.undo_attack = function (ev, animate) {
        bot = this.matchState.robots[ev.botId];
        if (bot === undefined) {
            console.log("Couldn't find attacking bot");
        }

        if (bot.type == 'artillery' && animate) {
            color = bot.team == 'a' ? 0xFF6666 : 0x6666FF;
            this.effectsLayer.lineStyle(this.cellSize < 16 ? 2 : 3, color, 0.5);
            src = this.getCellCenter(bot.pos);
            projectileX = ev.target % this.match.mapWidth;
            projectileY = Math.floor(ev.target / this.match.mapWidth);
            dest = this.getCellCenter({x: projectileX, y: projectileY});
            this.effectsLayer.moveTo(src.x, src.y);
            this.effectsLayer.lineTo(dest.x, dest.y);
            this.effectsLayer.beginFill(color, 0.5);
            this.effectsLayer.drawCircle(dest.x, dest.y, this.cellSize * 1.5)
            this.effectsLayer.endFill();
        }
    };


    Player.prototype.apply_death = function (ev, animate) {
        if (animate) {
            this.createExplosion(ev.bot.pos);
        }
    };


    Player.prototype.undo_death = function (ev, animate) {
        if (animate) {
            this.createExplosion(ev.bot.pos);
        }
    };


    Player.prototype.apply_removeDead = function (ev, animate) {
        bot = this.botSprites[ev.bot.id];
        delete this.botSprites[ev.bot.id];
        this.botLayer.removeChild(bot);

        if (this.hatSprites[ev.bot.id]) {
            for (var i=0; i < this.hatSprites[ev.bot.id].length; i++) {
                this.botLayer.removeChild(this.hatSprites[ev.bot.id][i]);
            }
            this.hatSprites[ev.bot.id] = [];
        }

        bot.destroy();
    };


    Player.prototype.undo_removeDead = function (ev, animate) {
        bot = new PIXI.Sprite(this.textures[ev.bot.team.toLowerCase()][ev.bot.type.toLowerCase()]);
        bot.interactive = true;
        bot.on('mousedown', this.onBotClick.bind(this));
        bot.id = ev.bot.id;
        bot.anchor.x = 0.5;
        bot.anchor.y = 0.5;
        bot.pivot.x = 0.5;
        bot.pivot.y = 0.5;
        if (ev.bot.type =='hq') {
            bot.width = this.botSize * 1.5;
            bot.height = this.botSize * 1.5;
        } else {
            bot.width = this.botSize;
            bot.height = this.botSize;
        }
        bot.location = ev.bot.pos;
        bot.position = this.getCellCenter(ev.bot.pos);
        bot.rotation = ev.bot.dir;
        this.botSprites[ev.bot.id] = bot;this.botLayer.addChild(bot);

        for (var i=0; i<ev.bot.hats.length; i++) {
            this.hatSprites[ev.bot.id].push(this.createHat(ev.bot.id, ev.bot.hats[i], ev.bot.hats.length));
        }

    };


    Player.prototype.apply_move = function (ev, animate) {
        sprite = this.botSprites[ev.botId];
        if (animate) {
            TweenLite.to(sprite.position, this.frameDuration/1000, this.getCellCenter(ev.to));
        } else {
            pos = this.getCellCenter(ev.to);
            sprite.position.x = pos.x;
            sprite.position.y = pos.y;
        }
        sprite.rotation = ev.dir;
    };


    Player.prototype.undo_move = function (ev, animate) {
        sprite = this.botSprites[ev.botId];
        if (sprite) {
            if (animate) {
                TweenLite.to(sprite.position, this.frameDuration / 1000, this.getCellCenter(ev.from));
            } else {
                pos = this.getCellCenter(ev.from);
                sprite.position.x = pos.x;
                sprite.position.y = pos.y;
            }
            sprite.rotation = ev.dir;
        }
    };


    Player.prototype.apply_defuseMine = function (ev, animate) {
        sprite = this.botSprites[ev.botId];
        if (sprite) {
            sprite.rotation = ev.dir;
        }
    };


    Player.prototype.undo_defuseMine = function (ev, animate) {
        sprite = this.botSprites[ev.botId];
        if (sprite) {
            sprite.rotation = ev.dir;
        }
    };


    Player.prototype.apply_hat = function (ev, animate) {
        bot = this.matchState.robots[ev.botId];
        if (!this.hatSprites[ev.botId]) {
            this.hatSprites[ev.botId] = [];
        }
        this.hatSprites[ev.botId].push(this.createHat(ev.botId, ev.hat, bot.hats.length));
    };

    Player.prototype.undo_hat = function (ev, animate) {
        this.botLayer.removeChild(this.hatSprites[ev.botId].pop());
    };

    /**
     * Create a random hat for a robot and puts it on it's head.
     *
     * @param {Number} botId - the id of the robot
     * @param {Number} hatId - a unique id for this hat.
     * @param {Number} hatCount - the total number of hats the bot should have AFTER this.
     */
    Player.prototype.createHat = function (botId, hatId, hatCount) {
        sprite = this.botSprites[botId];
        if (this.hatIdMap[hatId] === undefined) {
            this.hatIdMap[hatId] = Math.floor(Math.random() * this.hatTextures.length);
        }
        hat = new PIXI.Sprite(this.hatTextures[this.hatIdMap[hatId]]);
        hat.width = this.botSize;
        hat.height = this.botSize;
        hat.anchor = {x: 0.5, y: 1.0 + ((hatCount - 1) * this.botSize * 0.66)};
        hat.position = sprite.position;
        this.botLayer.addChild(hat);
        return hat;
    };


    /**
     * Creates an explosion at the given location.
     *
     * @param {Object} loc - the location where the explosion should occur
     */
    Player.prototype.createExplosion = function (loc) {
        sprite = new PIXI.extras.MovieClip(this.boomFrames);
        this.effectsLayer.addChild(sprite);
        sprite.position = this.getCellCenter(loc);
        sprite.anchor = {x: 0.5, y: 0.5};
        sprite.width = this.cellSize * 2;
        sprite.height= this.cellSize * 2;
        sprite.loop = false;
        sprite.on('complete', function () {
            this.effectsLayer.removeChild(sprite);
            sprite.destroy();
        }.bind(this));
        sprite.play();
    };

    /**
     * Converts 'game grid' coordinates to canvas coordinates.
     *
     * @param {Object} pt - the point to convert.
     * @returns {{x: number, y: number}}
     */
    Player.prototype.getCellCenter = function (pt) {
        return {x: (this.cellSize * pt.x) + (this.cellSize/2),
                y: (this.cellSize * pt.y) + (this.cellSize/2)};
    };


    /**
     * Updates the Status Layer
     */
    Player.prototype.updateStatusLayer = function () {
        this.statusLayer.clear();

        if (this.selectedBot) {
            this.statusLayer.lineStyle(0,0,0);
            bot = this.matchState.robots[this.selectedBot];
            sel = this.botSprites[this.selectedBot];

            if (sel) {
                hbs = bot.type == 'hq' ? (this.botSize * 1.5) / 2 : this.halfBotSize;
                this.statusLayer.beginFill(0xFFCC00, 0.75);
                this.statusLayer.drawRect(sel.x - hbs, sel.y - hbs, hbs * 2, hbs * 2);
                this.statusLayer.endFill();
            }
        }

        if (this.matchState) {
            this.statusLayer.lineStyle(2, 0x000000, 0.8);
            for (bk in this.matchState.robots) {
                sprite = this.botSprites[bk];
                bot = this.matchState.robots[bk];
                hbs = bot.type == 'hq' ? (this.botSize * 1.5) / 2 : this.halfBotSize;
                if (!bot.isDead) {
                    if (bot.action) {
                        this.statusLayer.moveTo(sprite.position.x - hbs + 1, sprite.position.y + hbs - 2);
                        this.statusLayer.lineTo(sprite.position.x + hbs - 1, sprite.position.y + hbs - 2);
                    }
                    this.statusLayer.moveTo(sprite.position.x - hbs + 1, sprite.position.y + hbs);
                    this.statusLayer.lineTo(sprite.position.x + hbs - 1, sprite.position.y + hbs);
                }

            }

            for (bk in this.matchState.robots) {
                bot = this.matchState.robots[bk];
                sprite = this.botSprites[bk];
                hbs = bot.type == 'hq' ? (this.botSize * 1.5) / 2 : this.halfBotSize;
                if (!bot.isDead) {
                    this.statusLayer.lineStyle(2, Util.getHealthColor(bot.energon / bot.maxEnergon), 0.8);
                    this.statusLayer.moveTo(sprite.position.x - hbs + 1,
                        sprite.position.y + hbs);
                    this.statusLayer.lineTo(sprite.position.x - hbs + 1 + ((bot.energon / bot.maxEnergon) * ((hbs * 2) - 2)),
                        sprite.position.y + hbs);
                    if (bot.action) {
                        this.statusLayer.lineStyle(2, 0x00AAFF, 0.8);
                        this.statusLayer.moveTo(sprite.position.x - hbs + 1,
                            sprite.position.y + hbs - 2);
                        this.statusLayer.lineTo(sprite.position.x - hbs + 1 + (((bot.actionRoundsTotal - bot.actionRounds) / bot.actionRoundsTotal) * ((hbs * 2) - 2)),
                            sprite.position.y + hbs - 2);
                    }
                }
            }
        }
    };

    /**
     * Callback for requestAnimationFrame.
     *
     * @param {Number} elapsed time
     */
    Player.prototype.animate = function (elapsed) {

        if (this.paused) {
            this.lastElapsed = elapsed;
            //elapsed = this.lastElapsed;
        }

        if (this.lastElapsed == 0) {
            this.lastElapsed = elapsed;
        }

        delta = (elapsed - this.lastElapsed);

        if (!this.paused) {
            this.frameTime += (delta);
        }

        this.lastElapsed = elapsed;

        // How many rounds do we advance?
        i=0;
        while (this.frameTime > this.frameDuration) {
            this.frameTime -= this.frameDuration;
            i++;
        }
        if (i > 0 && !this.paused) {
            this.transitionToRound(this.round + i);
        }

        this.updateStatusLayer();

        this.renderer.render(this.stage);
        if (!this.playbackComplete) {
            requestAnimationFrame(this.animate.bind(this));
        }
    };


    /**
     * Renders the mines and encampment squares onto the {@link Player#field} field.
     */
    Player.prototype.renderMap = function () {

        this.field.clear();
        this.field.beginFill(0xe0e0e0);
        this.field.drawRect(0, 0, this.boardWidth, this.boardHeight);

        this.field.endFill();
        if (this.matchState) {
            this.field.beginFill(MINE_NEUTRAL);
            this.renderMineList(this.matchState.mines.neutral);
            this.field.endFill();

            this.field.beginFill(MINE_A);
            this.renderMineList(this.matchState.mines.a);
            this.field.endFill();

            this.field.beginFill(MINE_B);
            this.renderMineList(this.matchState.mines.b);
            this.field.endFill();

            this.field.beginFill(0, 0);
            this.field.lineStyle(1, 0x009900, 0.8);

            // render encampments.

            for (mine in this.matchState.encampments) {
                gx = mine % this.match.mapWidth;
                gy = Math.floor(mine / this.match.mapWidth);
                px = (this.cellSize * gx);
                py = (this.cellSize * gy);
                this.field.drawRect(px + 1, py + 1, this.cellSize - 2, this.cellSize - 2);
                this.field.drawRect(px + 3, py + 3, this.cellSize - 6, this.cellSize - 6);
                if (this.cellSize > 10) {
                    this.field.drawRect(px + 5, py + 5, this.cellSize - 10, this.cellSize - 10);
                }
                if (this.cellSize > 14) {
                    this.field.drawRect(px + 7, py + 7, this.cellSize - 14, this.cellSize - 14);
                }
                if (this.cellSize > 18) {
                    this.field.drawRect(px + 9, py + 9, this.cellSize - 18, this.cellSize -18);
                }
                if (this.cellSize > 22) {
                    this.field.drawRect(px + 11, py + 11, this.cellSize - 22, this.cellSize -22);
                }
            }
        }
    };

    Player.prototype.botActionTexts = {
        layingMine: "Mining",
        defusingMine: "Defusing",
        capturing: "Capturing",
    };

    Player.prototype.upgrades = {
        FUSION: 25,
        DEFUSION: 25,
        PICKAXE: 25,
        VISION: 25,
        NUKE: 404
    };


    Player.prototype.textures = {a: {}, b: {}};

    Player.prototype.hatIdMap = {};

    window.Player = Player;
});