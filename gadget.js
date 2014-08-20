// Instantiate player
var player = new VersalPlayerAPI();

// Gadget base
var Gadget = function() {
  // Instance storage
  this.Points = [];
  this.Playbacks = [];
  this.Texts = [];
  this.Backgrounds = [];
  this.attributes = {};
  this.attributed = false;
  this.audioRecorder = null;
  this.SelectingImageFor = null;

  var self = this;

  // Author settings
  /*player.setPropertySheetAttributes({priveleges: { type: "Checkboxes",
    options:
    [
      {val: "can_draw", label: "Can draw"},
      {val: "can_record", label: "Can record"}
    ]
  }});*/

  // Asset URL template override
  player.assetUrlTemplate = player.assetUrlTemplate ||
    'http://localhost:3000/api/assets/<%= id %>';
  // Update based on env
  player.on('environmentChanged', function(data){
    player.assetUrlTemplate = data && data.assetUrlTemplate;
  }.bind(this));

  // Doesn't seem to work:
  //player.on('editableChanged', this.toggleEdit.bind(this));
  player.on('attributesChanged', this.attributesChanged.bind(this));
  // Asset (image) has been selected/uploaded
  player.on('assetSelected', function(assetData){
      //assetUrl is the output
      var assetUrl = player.assetUrl(assetData.asset.representations[0].id);
      
      if(self.SelectingImageFor) {

        // find current slide to apply background image
        var $current = $('div.content').find('.slide[data-slide="'+self.SelectingImageFor+'"]');
        // add to instance storage
        self.Backgrounds[$current.data('slide')] = assetUrl;
        // update background
        $current.find('canvas').css('background-image', 'url('+assetUrl+')');

        self.SelectingImageFor = null;

      }

    }.bind(this));

  // Handle edit toggling
  window.addEventListener('message', function(e){
    var message = e.data;
    //console.log(message.event, message.data);
    if(message.event=="setEditable") {
      self.toggleEdit(message.data);
    }
  });

  player.startListening();
};

Gadget.prototype.attributesChanged = function(attributes) {
 
  // This is firing twice, once and then again a second later
  // The 'attributed' flag keeps the canvas from being erased
  if(!this.attributed) {

    this.attributes = attributes;
    this.render();
    this.attributed = true;
  }

};

// Helper function
Gadget.prototype.makeText = function(obj, i) {

  var $text = $('<div class="text-box">').css('top', obj.y).css('left', obj.x).data('i', i);
  var $span = $('<span class="text-box-span">').html(obj.text);
  var $input = $('<input type="text" class="text-box-input">').val(obj.text);

  $text.append($span).append($input.hide());

  return $text;
};

// Gadget render
Gadget.prototype.render = function() {
  
  var self = this;

  // Using underscore templates
  var template = _.template($('body').find('.tpl').html(), {
    //editable: editable,
    //learner: learnerObject
  });

  // Load template
  $('div.content').html(template);

  // This is used throughout
  var $el = $('div.content');
  var existingSlides = self.attributes.slides || [];

  // Set defaults
  var learnerObject = {
    canDraw: false,
    canRecord: false
  };

  // Update defaults with stored data
  /*for(i=0; i<(self.attributes.priveleges || []).length; i++) {
    if(self.attributes.priveleges[i]=="can_draw") learnerObject.canDraw = true;
    if(self.attributes.priveleges[i]=="can_record") learnerObject.canRecord = true;
  }*/

  // Toggle elements based on settings
  $('.js-can-draw').toggle(self.editable || learnerObject.canDraw);
  $('.js-can-record').toggle(self.editable || learnerObject.canRecord);

  // Initialize first slide's canvas
  self.canvas($el.find('.slide.current'), (self.editable || (!self.editable && learnerObject.canDraw)));

  // Load any saved slides
  if(existingSlides && existingSlides.length) {

    for(i=0; i<existingSlides.length; i++) {

      // Simple fail safe
      if(existingSlides[i].points != undefined) {

        var thiscanvas;
        var $slide;
        var memCanvas = document.createElement('canvas');
        var memCtx = memCanvas.getContext('2d');

        // Make sure the first slide is the current slide
        if(i==0) {

          $slide = $el.find('.slide.current');
          thiscanvas = $slide.find('.sketchpad')[0];

        } else {
          // Prepare secondary slides by hiding and showing proper controls
          $slide = $el.find('.slide.current').clone();

          self.canvas($slide, (self.editable || (!self.editable && learnerObject.canDraw)));

          $el.find('.slides').append( $slide ).css('width', $el.find('.slides').width()+704);

          $slide.find('canvas').removeAttr('style');

          $slide.removeClass('current').attr('data-slide', i+1).find('.text.current-slide').html(i+1);

          $($el.find('.slides .slide')[i-1]).find('.traverse.forward').removeClass('disabled');

          $slide.find('.btn.play').addClass('disabled');

          if(self.editable) {
            $($el.find('.slides .slide')[i-1]).find('.remove-slide').show();

            if(existingSlides[i+1]) {
              $($el.find('.slides .slide')[i-1]).find('.new-slide').hide();
            }
          }

          $slide.find('.traverse.backward').removeClass('disabled');

          thiscanvas = $slide.find('.sketchpad')[0];
        }

        // Add the stored background
        if(existingSlides[i].background != undefined) {
          
          self.Backgrounds[i+1] = existingSlides[i].background;

          $slide.find('canvas').css('background-image', 'url('+existingSlides[i].background+')');
        }

        // Add any stored text
        if(existingSlides[i].texts != undefined) {

          self.Texts[i+1] = existingSlides[i].texts;

          for(t = 0; t<existingSlides[i].texts.length; t++) {

            var $text = self.makeText(existingSlides[i].texts[t], t);

            $slide.find('.canvas').append($text);

          }
        }

        // If a recording has been stored, add it to the instance and show the play button
        if(existingSlides[i].playback != undefined) {

          $slide.find('.btn.play').removeClass('disabled');

          self.Playbacks[i+1] = existingSlides[i].playback;
        }

        if(existingSlides[i].points.length) {

          self.Points[i+1] = existingSlides[i].points;

          for (var e = 0, len = existingSlides[i].points.length; e < len; e++) {

            for(var p = 1; p<existingSlides[i].points[e].point.length; p++) {
              
              self.Draw(
                thiscanvas.getContext('2d'), 
                existingSlides[i].points[e].point[p-1], 
                existingSlides[i].points[e].point[p], 
                existingSlides[i].points[e].point[p+1], 
                existingSlides[i].points[e].point[p+2], 
                existingSlides[i].points[e].stroke, 
                0
              );
            }
          }
        }

        $el.find('.text.total-slides').html(existingSlides.length);
      }
    }
  }

  // Adding a slide
  $el.on("click", '.add.new-slide', function(e) {

    // Clone the old slide, create the new, then clear the new
    var $old = $el.find('.slide.current');
    var $new = $old.clone();
    var current = $el.find('.slides .slide').length+1;

    $old.removeClass('current');

    $new.addClass('current').attr('data-slide', current);

    $el.find('.slides').append( $new ).css('width', $el.find('.slides').width()+704);

    $new.find('.text.current-slide').html(current);
    $el.find('.text.total-slides').html($el.find('.slides .slide').length);

    $new.find('.traverse.backward').removeClass('disabled');
    $old.find('.traverse.forward').removeClass('disabled');

    $new.find('.btn.play').addClass('disabled');

    $old.find('.add.new-slide').hide();
    $old.find('.remove-slide').show();

    $new.find('.text-box').remove();

    $new.find('canvas').removeAttr('style');

    self.canvas($el.find('.slide.current'), (self.editable || (!self.editable && learnerObject.canDraw)));

    e.stopImmediatePropagation();
  })
  // Removing a slide
  .on("click", '.remove-slide', function(e) {

    // Remove the elements from the DOM and update the slide counts
    $el.find('.slide.current').remove();

    var i = $(this).closest('.slide').data('slide');

    var $slides = $el.find('.slides .slide');

    $( $slides[(i==1 ? 0 : i-1)] ).addClass('current');

    $( $slides[0] ).find('.traverse.backward').addClass('disabled');
    $( $slides[$slides.length-1] ).find('.traverse.forward').addClass('disabled');

    $el.find('.text.total-slides').html($el.find('.slides .slide').length);

    $slides.each(function(i) {

      $(this).attr('data-slide', i+1).find('.text.current-slide').html(i+1);
    })

    e.stopImmediatePropagation();

  })
  // Traversing slides
  .on("click", '.traverse.backward', function(e) {

    // The transition is handled via CSS so just updating current class here
    if(!$(this).hasClass('disabled')) {

      var $slides = $el.find('.slides .slide');

      var i = $(this).closest('.slide').attr('data-slide');

      $( $slides[i-1] ).removeClass('current');

      $( $slides[i-2] ).addClass('current');
    }

    e.stopImmediatePropagation();
  })
  .on("click", '.traverse.forward', function(e) {

    // The transition is handled via CSS so just updating current class here
    if(!$(this).hasClass('disabled')) {

      var $slides = $el.find('.slides .slide');

      var i = $(this).closest('.slide').attr('data-slide');

      $( $slides[i-1] ).removeClass('current');

      $( $slides[i] ).addClass('current');
    }

    e.stopImmediatePropagation();
  });

  player.setHeight($('body').outerHeight());
};

Gadget.prototype.toggleEdit = function(data) {

  var self = this;

  // Loops through and store all of the slide data for each
  if(!data.editable) {

    var slides = [];

    $('.slides .slide').each(function() {

      var id = $(this).data('slide');

      var points = (self.Points[id] != undefined ? self.Points[id] : null);

      var playback = (self.Playbacks[id] != undefined ? self.Playbacks[id] : null);

      var texts = (self.Texts[id] != undefined ? self.Texts[id] : null);

      var background = (self.Backgrounds[id] != undefined ? self.Backgrounds[id] : null);

      slides.push({points: points, playback: playback, texts: texts, background: background});
    });

    // Save it!
    player.setAttributes({slides: slides});
    // Flag to prevent double saving (and overwriting)
    this.attributed = false;
  }

  this.editable = data.editable
  this.render();
};

// Drawing function used during playback
Gadget.prototype.Draw = function(ctx, p1, p2, p3, p4, stroke, delay) {

  var self = this;

  window.setTimeout(function() {

    ctx.lineWidth = stroke.w;
    ctx.fillStyle = stroke.fill;
    ctx.strokeStyle = stroke.fill;
    ctx.globalCompositeOperation = stroke.globalCompositeOperation;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);

    var midPoint = self.midPointBtw(p1, p2);
    ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);

    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    if(p3 && p4) {
      var midPoint2 = self.midPointBtw(p3, p4);
      ctx.beginPath();
      ctx.moveTo(p3.x, p3.y);
      ctx.quadraticCurveTo(p3.x, p3.y, midPoint2.x, midPoint2.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.stroke();
    }

  }, delay);
};

Gadget.prototype.midPointBtw = function(p1, p2) {
  return {
    x: p1.x + (p2.x - p1.x) / 2,
    y: p1.y + (p2.y - p1.y) / 2
  };
};

// Handles each canvas instance
Gadget.prototype.canvas = function($el, editable){

  var self = this;

  window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;

  // get the canvas element and its context
  var lineW = $el.find('.selected .circle').data('width'),
      fillC = $el.find('.selected .color').data('color');

  // A whole load of presets and flags
  var canvas = $el.find('.sketchpad')[0];
  var ctx = canvas.getContext('2d');

  var memCanvas = document.createElement('canvas');
  var memCtx = memCanvas.getContext('2d');

  var w = 700, h = 350;

  canvas.setAttribute("height", h);
  canvas.setAttribute("width", w);
  memCanvas.setAttribute("height", h);
  memCanvas.setAttribute("width", w);

  ctx.lineJoin = ctx.lineCap = 'round';

  var isDrawing = false;
  var points = [];

  var CanvasRecording = false;
  var WhiteboardPlayback = [];
  var Erasing = false;
  var Playing = false;
  var PlayingTO;
  var lastFill;

  if(self.Points[$el.data('slide')] == undefined) self.Points[$el.data('slide')] = [];

  // The beginning of a draw
  canvas.onmousedown = function(event) {

    // Make sure they can draw
    if(Playing || !editable) return;

    isDrawing = true;

    ctx.lineWidth = lineW;
    ctx.fillStyle = fillC;
    ctx.strokeStyle = fillC;

    memCtx.clearRect(0, 0, w, h);
    memCtx.drawImage(canvas, 0, 0);

    var x,y;

    // get coordinates
    if (event.layerX || event.layerX == 0) { // Firefox
      x = event.layerX;
      y = event.layerY;
    } else if (event.offsetX || event.offsetX == 0) { // Opera
      x = event.offsetX;
      y = event.offsetY;
    }

    if(CanvasRecording) {

      if(WhiteboardPlayback.length && WhiteboardPlayback[0].type=="pause" && !WhiteboardPlayback[0].end_time) {
        WhiteboardPlayback[0].end_time = Date.now();
      }

      WhiteboardPlayback.unshift({type: "draw", start_time: Date.now(), start_point: {x:x,y:y}, points: [], stroke: {w: ctx.lineWidth, fill: ctx.fillStyle, globalCompositeOperation: ctx.globalCompositeOperation}, end_time: null});
      WhiteboardPlayback[0].points.push({ x: x, y: y });
    }

    points.push({ x: x, y: y });

    if(Erasing) {

      self.Points[$el.data('slide')].push({ stroke: {w:lineW, fill:fillC, globalCompositeOperation:"source-over"}, point: [{x: x, y: y}] });
    } else {

      self.Points[$el.data('slide')].unshift({ stroke: {w:lineW, fill:fillC, globalCompositeOperation:"source-over"}, point: [{x: x, y: y}] });
    }
  };

  // Drawing
  canvas.onmousemove = function(event) {
    
    if (!isDrawing || Playing || !editable) return;

    var cx,cy;

    // get coordinates
    if (event.layerX || event.layerX == 0) { // Firefox
      cx = event.layerX;
      cy = event.layerY;
    } else if (event.offsetX || event.offsetX == 0) { // Opera
      cx = event.offsetX;
      cy = event.offsetY;
    }

    if(CanvasRecording) {
      WhiteboardPlayback[0].points.push({ x: cx, y: cy });
    }

    points.push({ x: cx, y: cy });

    ctx.globalCompositeOperation = "source-over";

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(memCanvas, 0, 0);

    var p1 = points[0];
    var p2 = points[1];

    // Erasing is a different action completely
    if(Erasing) { 

      ctx.globalCompositeOperation = 'destination-out';

      self.Points[$el.data('slide')][self.Points[$el.data('slide')].length-1].point.push({ x: cx, y: cy});

      self.Points[$el.data('slide')][self.Points[$el.data('slide')].length-1].stroke.globalCompositeOperation = 'destination-out';

      if(CanvasRecording) {
        WhiteboardPlayback[0].stroke.globalCompositeOperation = 'destination-out';
      }
    } else {
      self.Points[$el.data('slide')][0].point.push({ x: cx, y: cy});
    }

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);

    for (var i = 1, len = points.length; i < len; i++) {
      // we pick the point between pi+1 & pi+2 as the
      // end point and p1 as our control point
      var midPoint = self.midPointBtw(p1, p2);
      ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
      p1 = points[i];
      p2 = points[i+1];
    }
    // Draw last line as a straight line while
    // we wait for the next point to be able to calculate
    // the bezier control point
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  };

  // All done drawing
  canvas.onmouseup = function() {
    isDrawing = false;
    points.length = 0;
    memCtx.clearRect(0, 0, w, h);
    memCtx.drawImage(canvas, 0, 0);

    // If it was recording, start the pause action
    if(CanvasRecording) {
      WhiteboardPlayback[0].end_time = Date.now();
      WhiteboardPlayback.unshift({type:"pause", start_time: Date.now(), end_time: null});
    }
  };

  // Manages the playback of a set of actions
  function Playback(obj) {

    var wi = obj.length;
    PlayingTO = null;

    while(wi--) {

      var duration = obj[wi].end_time - obj[wi].start_time;

      if(obj[wi].type=="pause") {

        var newPlayback = obj.slice(0, wi);

        if( obj[wi+1].type == "draw" ) {
          var drawtime = obj[wi+1].end_time - obj[wi+1].start_time;
        }

        PlayingTO = window.setTimeout(function() {
          Playback(newPlayback);
        }, duration+drawtime);
        break;
      }

      if(obj[wi].type=="draw") {

        for (var i = 1, len = obj[wi].points.length; i < len; i++) {
          self.Draw(ctx, obj[wi].points[i-1], obj[wi].points[i], obj[wi].points[i], obj[wi].points[i+1], obj[wi].stroke, (duration/obj[wi].points.length)*i);
        }
      }

      if(obj[wi].type=="text") {

        var $text = self.makeText(self.Texts[$el.data('slide')][obj[wi].i], obj[wi].i);

        $el.find('.canvas').append($text);
      }
    }

    if(!PlayingTO) {

      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(memCanvas, 0, 0);

      $el.find('.btn.record').removeClass('disabled');
      $el.find('.btn.play').removeClass('disabled');
      $el.find('.btn.clear').removeClass('disabled');

      Playing = false;
    }
  }

  // Canvas event listeners
  $el.on("click", '.btn.record', function(e) {

    // Toggles recording on or off
    if(!$(this).hasClass('disabled')) {
      if(CanvasRecording) {

        CanvasRecording = false;
        $(this).removeClass('recording');

        if(WhiteboardPlayback.length && WhiteboardPlayback[0].type=="pause") {
          WhiteboardPlayback[0].end_time = WhiteboardPlayback[0].start_time+100;
          self.Playbacks[$el.data('slide')] = {i: $el.data('slide'), playback: WhiteboardPlayback};
        }

        $el.find('.btn.play').removeClass('disabled');
        $el.find('.btn.clear').removeClass('disabled');

        //self.audioRecorder.stop();

      } else {

        CanvasRecording = true;
        $(this).addClass('recording');
        $el.find('.btn.play').addClass('disabled');
        $el.find('.btn.clear').addClass('disabled');

        /*var $audio = $('<audio>');

        navigator.webkitGetUserMedia({audio:true}, function(stream) {
          
          window.AudioContext = window.AudioContext || window.webkitAudioContext;
          navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
          window.URL = window.URL || window.webkitURL;
          
          var audio_context = new AudioContext;

          var input = audio_context.createMediaStreamSource(stream);
    
          input.connect(audio_context.destination);
          
          self.audioRecorder = new Recorder(input);
          self.audioRecorder.record();
        }, function() { return; });*/
      }
    }

    e.stopImmediatePropagation();
  })
  .on("click", '.btn.play', function(e) {

    // Playing of a playback. Will be disabled if a playback isn't present
    if(!$(this).hasClass('disabled')) {

      Playing = true;

      canvas.width = canvas.width;

      Playback(self.Playbacks[$el.data("slide")].playback);

      $el.find('.btn.record').addClass('disabled');
      $el.find('.btn.play').addClass('disabled');
      $el.find('.btn.clear').addClass('disabled');
      $el.find('.text-box').remove();
    }

    e.stopImmediatePropagation();
  })
  .on("click", '.btn.clear', function(e) {

    // Clearing the canvas clears the drawing, background, texts, and playbacks
    if(!$(this).hasClass('disabled')) {

      canvas.width = canvas.width;
      memCanvas.width = canvas.width;
      WhiteboardPlayback = [];
      self.Playbacks[$el.data("slide")] = [];
      self.Texts[$el.data("slide")] = [];
      self.Backgrounds[$el.data("slide")] = [];
      self.Points[$el.data("slide")] = [];
      $el.find('canvas').css('background-image', '');
      $el.find('.text-box').remove();
      $el.find('.btn.play').addClass('disabled');

      e.stopImmediatePropagation();
    }
  })
  .on("click", '.grouped li', function(e) {

    // These are the stroke and color actions
    $(this).closest('.grouped').find('li').removeClass('selected');
    $(this).addClass('selected');

    lineW = $el.find('.selected .circle').data('width');

    if(!Erasing) {
      fillC = $el.find('.selected .color').data('color');
    } else {
      lastFill = $el.find('.selected .color').data('color');
    }

    e.stopImmediatePropagation();
  })
  .on("click", '.erase', function(e) {

    // Eraser controls
    if($(this).closest('li').hasClass('selected')) {

      $(this).closest('li').removeClass('selected');

      fillC = lastFill;
      Erasing = false;

    } else {

      $(this).closest('li').addClass('selected');

      lastFill = fillC;
      Erasing = true;

      fillC = "rgba(0,0,0,1)";
    }

    e.stopImmediatePropagation();
  })
  .on("click", '.add.image', function(e) {

    self.SelectingImageFor = $el.data('slide');

    // Adding or editing the background image of a slide
    player.requestAsset({type:"image", attribute: "slide_"+$el.data('slide')+"_image"});

    e.stopImmediatePropagation();
  })
  .on("click", '.add.text', function(e) {

    // Adding individual boxes of text
    // This also controls the 'blurring' of text boxes, as well as removal by deleting all of the text
    var Adding = false;

    if(!Playing) {

      if($(this).closest('li').hasClass('selected')) {

        $(this).closest('li').removeClass('selected');

        $el.find('.text-box .text-box-input').hide();
        $el.find('.text-box .text-box-span').show();

        $el.find('.text-busy').removeClass('text-busy busy').off("click");

        Adding = false;

      } else {

        $(this).closest('li').addClass('selected');

        var $text = $('<div class="text-box">');
        var $span = $('<span class="text-box-span">').html('Hello World!');
        var $input = $('<input type="text" class="text-box-input">').val('Hello World!');

        $text.append($span).append($input);

        $el.find('.canvas').addClass('busy text-busy');

        $el.find('.text-busy').on("click", function(e) {

          if(!Adding) {
          
            Adding = true;

            var offset = $(this).offset();
            var y = e.clientY - offset.top;
            var x = e.clientX - offset.left;
            var i = (self.Texts[$el.data('slide')] ? self.Texts[$el.data('slide')].length : 0);

            $text.css('top', y).css('left', x);

            $('.slide.current .canvas').append( $text.data('i', i ) );

            if(CanvasRecording) {
              if(WhiteboardPlayback.length && WhiteboardPlayback[0].type=="pause") {
                WhiteboardPlayback[0].end_time = Date.now();
                WhiteboardPlayback.unshift({type:"text", i: i, start_time: Date.now(), end_time: Date.now()+100});
                WhiteboardPlayback.unshift({type:"pause", start_time: Date.now(), end_time: null});
              }
            }

            $span.hide();
            $input.show().focus().on("keyup", function(e) {
              
              if(!$(this).val() && $span.html()!="empty") {
                $span.html('empty');
                return;
              } 

              if($span.html()=="empty" && e.keyCode==8) {

                $text.remove();
                $el.find('.add.text').removeClass('selected');
                $(this).removeClass('text-busy busy').off("click");
                self.Texts.splice($text.data('i'),1);

                Adding = false;
              } else {
                
                $span.html( $(this).val() );
                self.Texts[$el.data('slide')][$text.data('i')].text = $(this).val();
              }
            });

            if(!self.Texts[$el.data('slide')]) self.Texts[$el.data('slide')] = [];

            self.Texts[$el.data('slide')].push({text: 'Hello World!', x: x, y: y});

          } else {

            $el.find('.add.text').closest('li').removeClass('selected');

            $span.show();
            $input.hide();

            $(this).removeClass('text-busy busy').off("click");

            Adding = false;
          }

          e.stopImmediatePropagation();
        });
      }
    }

    e.stopImmediatePropagation();
  })
  .on("click", '.text-box', function(e) {

    // Editing of a text box after it has been added

    var $me = $(this);

    if(!isDrawing && !Playing) {

      var $span = $me.find('.text-box-span');
      var $input = $me.find('.text-box-input');

      $span.hide();
      
      $input.show().focus().on("keyup", function(e) {
              
        if(!$(this).val() && $span.html()!="empty") {
          $span.html('empty');
          return;
        } 

        if($span.html()=="empty" && e.keyCode==8) {

          $me.remove();
          $el.find('.add.text').removeClass('selected');
          self.Texts.splice($me.data('i'),1);

        } else {
          
          $span.html( $(this).val() );
          self.Texts[$el.data('slide')][$me.data('i')].text = $(this).val();
        }
      });

      $input.on("blur", function() {

        $span.show();
        $(this).hide();
      });
    }

    e.stopImmediatePropagation();
  });
};

// Fire that gadget!
new Gadget();
