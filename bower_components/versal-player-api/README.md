# Versal Player API [![Build Status](https://travis-ci.org/Versal/player-api.svg?branch=master)](https://travis-ci.org/Versal/player-api) [![Code Climate](https://codeclimate.com/github/Versal/player-api.png)](https://codeclimate.com/github/Versal/player-api)

The Versal Player API provides a convenience layer and stability buffer on top
of the [gadget api spec](https://github.com/Versal/gadget-api-spec). Please
refer to the gadget api spec for the full list of supported events and commands.

## Installation

Include as a Bower dependency:

    bower install --save Versal/player-api

With web components:

    <link rel="import" href="bower_components/player-api/index.html">

With vanilla HTML:

    <script src="bower_components/eventEmitter/EventEmitter.js"></script>
    <script src="bower_components/versal-player-api/index.js"></script>

## Usage

    var player = new VersalPlayerAPI();
    player.on('attributesChanged', function(attrs){
      // do something
    });

    // send this command to receive initial events
    player.startListening();

    // update the iframe height
    player.setHeightToBodyHeight();

    // continuously watch for changes in height (e.g. because of window resizes)
    player.watchBodyHeight();

## Change log
- **0.3.3** Adds `setHeightToBodyHeight` and `watchBodyHeight` methods
- **0.3.2** Removed old "challenges" methods
- **0.3.1** Minor fixes
- **0.3.0** Remove compilation
- **0.2.4** Remove setEditable event completely in favor for editableChanged event
