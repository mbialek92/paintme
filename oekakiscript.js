/*jslint vars: true, unparam: false, undef: true, white: true, maxerr: 50 */

(function () {
    
    // Initialize 2D canvas, the main drawing surface.
    var canvas = document.querySelector('#paint');
    var ctx = canvas.getContext('2d');

    var sketch = document.querySelector('#oekaki');
    var sketch_style = getComputedStyle(sketch);
    canvas.width = parseInt(sketch_style.getPropertyValue('width'));
    canvas.height = parseInt(sketch_style.getPropertyValue('height'));
    
    var opts = document.getElementById('brush_size');
    var ctx_opts = opts.getContext('2d');
    var centerX = opts.width / 2;
    var centerY = opts.height / 2;
    var radius;
    
    // Let's create a temporary canvas - we will store points on an array
    // for this canvas, copy them to the main canvas, clear this canvas,
    // then empty the array. This allows us to draw and repeat the action
    // of clicking and dragging the mouse without drawing curves over curves.
    var tmp_canvas = document.createElement('canvas');
    var tmp_ctx = tmp_canvas.getContext('2d');
    tmp_canvas.id = 'tmp_canvas';
    tmp_canvas.width = canvas.width;
    tmp_canvas.height = canvas.height;
    
    sketch.appendChild(tmp_canvas);

    // Mouse interactions, yay!
    var mouse = {x: 0, y: 0};
    var start_mouse = {x: 0, y: 0};
    var last_mouse = {x: 0, y: 0};
    
    var sprayIntervalID;
    
    // This sets up the pencil points array for drawing.
    var ppts = [];
    
    // This sets up the undo array, which stores actions for undo/redo.
    var undo_arr = [];
    var undo_count = 0;
    var empty_canv;
    
    // Our current tool click and choose:
    var tool = 'brush';
    
    $('#tools button').on('click', function () {
        tool = $(this).attr('id');
        console.log(tool);
    });
    
    // Click and choose for coloring:
    $('#colors button').on('click', function () {
        tmp_ctx.strokeStyle = $(this).attr('id');
        tmp_ctx.fillStyle = tmp_ctx.strokeStyle;
        console.log(tmp_ctx.strokeStyle);
        
        drawBrush();
    });
    
    // Here, we set our tool selection with a handy else-if statement:
        
    var onPaint = function () {
        
            if (tool === 'brush')
                { onPaintBrush(); }
        
            else if (tool === 'line')
                { onLinePaint(); }
        
            else if (tool === 'rectangle')
                { onRectPaint(); }
        
            else if (tool === 'ellipse')
                { onEllipsePaint(tmp_ctx); }
        
            else if (tool === 'circle')
                { onCirclePaint(); }
        
            else if (tool === 'circlator')
                { onCirclatorPaint(); }
        
            else if (tool === 'spray')
                { generateSprayParticles(); }
        
            else if (tool === 'eraser')
                { onErase(); }
        
    };
    
    // Mouse capture listener for both temporary and main canvas.
        tmp_canvas.addEventListener('mousemove', function (e) {
        mouse.x = typeof e.offsetX !== 'undefined' ? e.offsetX : e.layerX;
        mouse.y = typeof e.offsetY !== 'undefined' ? e.offsetY : e.layerY;
    }, false);
    
        canvas.addEventListener('mousemove', function (e) {
        mouse.x = typeof e.offsetX !== 'undefined' ? e.offsetX : e.layerX;
        mouse.y = typeof e.offsetY !== 'undefined' ? e.offsetY : e.layerY;
    }, false);
    
    // DrawBrush function: this sets the basis on how to dynamically change the size of
    // the paintbrush.   
    var drawBrush = function () {
        ctx_opts.clearRect(0, 0, opts.width, opts.height);
        
        radius = tmp_ctx.lineWidth;
        radius = radius / 2;
        
        ctx_opts.beginPath();
        ctx_opts.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
        ctx_opts.fillStyle = tmp_ctx.strokeStyle;
        ctx_opts.globalAlpha = tmp_ctx.globalAlpha;
        ctx_opts.fill();
        
    };
    
    // This sets up the default drawing specs upon loading, along with telling the tool
    // how large the brush should be.
    tmp_ctx.lineWidth = document.getElementById("width_range").value;
    tmp_ctx.lineJoin = 'round';
    tmp_ctx.lineCap = 'round';
    tmp_ctx.strokeStyle = 'pink';
    tmp_ctx.fillStyle = 'pink';
        
    // Show the current brush specs!
    drawBrush();
    
    // The first sighting of the UNDO function: this sets up sending the drawing information to the undo array.
    empty_canv = canvas.toDataURL();
    undo_arr.push(empty_canv);
    
    // Mousedown, mousemove, mouseup events to begin painting.
    tmp_canvas.addEventListener('mousedown', function (e) {
        tmp_canvas.addEventListener('mousemove', onPaint, false);
        
        mouse.x = typeof e.offsetX !== 'undefined' ? e.offsetX : e.layerX;
        mouse.y = typeof e.offsetY !== 'undefined' ? e.offsetY : e.layerY;
        
        start_mouse.x = mouse.x;
        start_mouse.y = mouse.y;
        
        ppts.push({x: mouse.x, y: mouse.y});
        
    // This sets up the spray paint tool.
        sprayIntervalID = setInterval(onPaint, 50);
        onPaint();
        
    }, false);
        
    tmp_canvas.addEventListener('mouseup', function () {
        tmp_canvas.removeEventListener('mousemove', onPaint, false);
        
    // This builds the basis of the eraser tool. We're going to combine
    // this with the destination-out operation further down the script. This will work 
    // something like a subtract boolean operation: anything we draw will be transparent,
    // except the portions of the canvas that don't overlap with the drawing.
        ctx.globalCompositeOperation = 'source-over';
        
    // Clear up spraying tool intervals.
        clearInterval(sprayIntervalID);
        
    // Let's write the points to the real canvas, then clear the 
    // temp canvas and empty the pencil points.
        ctx.drawImage(tmp_canvas, 0, 0);
        tmp_ctx.clearRect(0, 0, tmp_canvas.width, tmp_canvas.height);
    
    // Emptying the pencil points in the array...
        ppts = [];
        
    // This code pushes the canvas data to the undo array and sets the count to 0 upon startup.
        undo_arr.push(canvas.toDataURL());
        undo_count = 0;
        
    }, false);
    
    // Setting up the Undo function: here we find the event listener and the if-else statement that sets the rules. 
    // This function works off the array we set up earlier. This counts the amount of items stored in the array.
    // If the length of the array is greater than 1 (meaning one action has been stored), then an UNDO can be applied.
    // However, if the undo count is less than or equal to the length of the array, meaning you intend to UNDO the first
    // stroke on the canvas, you will not be able to REDO it. A message will appear for the user to allow it or not.
    document.getElementById("undo").addEventListener("click", function () {
        
        if (undo_arr.length > 1) {
            if (undo_count + 1 < undo_arr.length) {
                if (undo_count + 2 === undo_arr.length) {
                    if (confirm("Careful! If you UNDO this step, you will NOT be able to REDO it. Do you wish to continue?")) {
                        undo_count++;
                        UndoFunc(undo_count);
                    }
                }
            else {
                undo_count++;
                UndoFunc(undo_count);
            }
                
            if ( undo_count + 1 === undo_arr.length ) {
                undo_count = 0; undo_arr = [];
                undo_arr.push(empty_canv); }
            }
    
        }
    });
    
    // Redo function! As long as there is at least one action to redo from the array, you may redo the
    // last action drawn.
    document.getElementById("redo").addEventListener("click", function () {
        if (undo_count > 0) {
            undo_count--;
            UndoFunc(undo_count);
        }
        
    });
        
    // Here we cement the change function for the line width.  
    document.getElementById("width_range").addEventListener("change", function () {
        tmp_ctx.lineWidth = document.getElementById("width_range").value / 5;
        
        drawBrush();
    
    });
        
    // How about setting an opacity range with another change function?
    document.getElementById("opacity_range").addEventListener("change", function () {
        tmp_ctx.globalAlpha = document.getElementById("opacity_range").value / 100;
        
    });
    
    // Clearing the canvas function: this clears the entire canvas upon the user clicking the "Clear"
    // function button. The user will be prompted if they are sure they want the entire canvas cleared.
    document.getElementById("clear").addEventListener("click", function () {
        if (confirm("This will CLEAR the entire canvas. Do you wish to continue?")) {
            ctx.clearRect(0, 0, tmp_canvas.width, tmp_canvas.height);
        }
    });
        
    // Basic paintbrush function: these points are saved into an array
    // on the temp canvas to create the paths we draw.   
    var onPaintBrush = function () {
        ppts.push({x: mouse.x, y: mouse.y});
        
        if (ppts.length < 3) {
            var b = ppts[0];
            tmp_ctx.beginPath();
            tmp_ctx.arc(b.x, b.y, tmp_ctx.lineWidth / 2, 0, Math.PI * 2, !0);
            tmp_ctx.fill();
            tmp_ctx.closePath();
                
            return;
        }
        
    // We clear the temporary canvas each time we begin to draw.
        tmp_ctx.clearRect(0, 0, tmp_canvas.width, tmp_canvas.height);
        
        tmp_ctx.beginPath();
        tmp_ctx.moveTo(ppts[0].x, ppts[0].y);
        
    // This loop calculates the mid point of the next two points,
    // creates curves that complete at these points, then joins these
    // curves to create interpolation/smooth transitions.
        for (var i = 1; i < ppts.length - 2; i++) {
            var c = (ppts[i].x + ppts[i + 1].x) / 2;
            var d = (ppts[i].y + ppts[i + 1].y) / 2;
            
            tmp_ctx.quadraticCurveTo(ppts[i].x, ppts[i].y, c, d);
        }
        
    // This smoothes the last two points so they don't stick out.
        tmp_ctx.quadraticCurveTo(
            ppts[i].x,
            ppts[i].y,
            ppts[i + 1].x,
            ppts[i + 1].y
        );
        tmp_ctx.stroke();
    };
    
    // This is the line function!
    var onLinePaint = function () {
        
    // Don't forget to clear the tmp canvas...
    tmp_ctx.clearRect(0, 0, tmp_canvas.width, tmp_canvas.height);
		
                tmp_ctx.beginPath();
                tmp_ctx.moveTo(start_mouse.x, start_mouse.y);
                tmp_ctx.lineTo(mouse.x, mouse.y);
                tmp_ctx.stroke();
                tmp_ctx.closePath();
		
            };
    
    // Rectangle function
    var onRectPaint = function () {
        
    // Again, clearing the tmp canvas
        tmp_ctx.clearRect(0, 0, tmp_canvas.width, tmp_canvas.height);
		
                var x = Math.min(mouse.x, start_mouse.x);
                var y = Math.min(mouse.y, start_mouse.y);
                var width = Math.abs(mouse.x - start_mouse.x);
                var height = Math.abs(mouse.y - start_mouse.y);
                tmp_ctx.strokeRect(x, y, width, height);
		
            };
    
    // Ellipse function: this works through a series of cool math functions involving bezier curves.
    // This does NOT create a mathematically correct ellipse, but approximates it. We use bezierCurveTo because
    // attempting to use two quadratic curves results in ugly results!
    // In the future, as the ellipse() function becomes more usable outside of Chrome/Opera, this will be rebuilt...
    function onEllipsePaint(ctx) {
    
    // Clear the tmp canvas...
        tmp_ctx.clearRect(0, 0, tmp_canvas.width, tmp_canvas.height);
        
                var x = Math.min(mouse.x, start_mouse.x);
                var y = Math.min(mouse.y, start_mouse.y);
                var w = Math.abs(mouse.x - start_mouse.x);
                var h = Math.abs(mouse.y - start_mouse.y);
    
                var kappa = .5522848, // This allows us to draw as close to a quadratic curve as possible.
                    ox = (w / 2) * kappa, // Offset horizontal
                    oy = (h / 2) * kappa, // Offset vertical
                    xe = x + w, // x-end
                    ye = y + h, // y-end
                    xm = x + w / 2, // x-middle
                    ym = y + h / 2; // y-middle

                ctx.beginPath();
                ctx.moveTo(x, ym);
                ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
                ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
                ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
                ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
                ctx.closePath();
                ctx.stroke();
    };
    
    // Circle function
    var onCirclePaint = function () {
    
    // Clearing the tmp canvas...
        tmp_ctx.clearRect(0, 0, tmp_canvas.width, tmp_canvas.height);
        
              var x = (mouse.x + start_mouse.x) / 2;
    var y = (mouse.y + start_mouse.y) / 2;
 
    var radius = Math.max(
        Math.abs(mouse.x - start_mouse.x),
        Math.abs(mouse.y - start_mouse.y)
    ) / 2;
 
    tmp_ctx.beginPath();
    tmp_ctx.arc(x, y, radius, 0, Math.PI*2, false);
    // tmp_ctx.arc(x, y, 5, 0, Math.PI*2, false);
    tmp_ctx.stroke();
    tmp_ctx.closePath();
            };
    
    // Circlator function
    var onCirclatorPaint = function () {
        
        tmp_ctx.beginPath();
        
                  var x = (mouse.x + start_mouse.x) / 2;
    var y = (mouse.y + start_mouse.y) / 2;
 
    var radius = Math.max(
        Math.abs(mouse.x - start_mouse.x),
        Math.abs(mouse.y - start_mouse.y)
    ) / 2;
 
    tmp_ctx.beginPath();
    tmp_ctx.arc(x, y, radius, 0, Math.PI*2, false);
    // tmp_ctx.arc(x, y, 5, 0, Math.PI*2, false);
    tmp_ctx.stroke();
    tmp_ctx.closePath();
                
            };
    
    // The meat and potatoes of the spray tool (this figures out the random scatter):
    var getRandomOffset = function(radius) {
        
        var random_angle = Math.random() * (3*Math.PI);
        var random_radius = Math.random() * radius;
        
        return {
            x: Math.cos(random_angle) * random_radius,
            y: Math.sin(random_angle) * random_radius
        };
    };

    // This plays with the density of the spray tool:
    var generateSprayParticles = function() {
        
        var density = tmp_ctx.lineWidth*2;
        for (var i = 0; i < density; i++) {
            var offset = getRandomOffset(tmp_ctx.lineWidth);
            
            var x = mouse.x + offset.x;
            var y = mouse.y + offset.y;
            
            tmp_ctx.fillRect(x, y, 1, 1);
        }
    };
        
    // Erase function: this utilizes the globalCompositeOperation built further up in this script.
    // Source-over and destination-out work like 3D boolean operations, where what overlaps ends up
    // either removed or retained. In this case, whatever overlaps the eraser ends up disappearing.
    var onErase = function () {
        
    // Save all the points in an array...
        ppts.push({x: mouse.x, y: mouse.y});
        
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
        ctx.lineWidth = tmp_ctx.lineWidth;
        
        if (ppts.length < 3) {
            var b = ppts[0];
            ctx.beginPath();
            ctx.arc(b.x, b.y, ctx.lineWidth / 2, 0, Math.PI * 2, !0);
            ctx.fill();
            ctx.closePath();
                
            return;
        }
        
    // To make our eraser as smooth as the paintbrush:
        ctx.beginPath();
        ctx.moveTo(ppts[0].x, ppts[0].y);
        
        for (var i = 1; i < ppts.length - 2; i++) {
            var c = (ppts[i].x + ppts[i + 1].x) / 2;
            var d = (ppts[i].y + ppts[i + 1].y) / 2;
            
            ctx.quadraticCurveTo(ppts[i].x, ppts[i].y, c, d);
        }
        
        ctx.quadraticCurveTo(
            ppts[i].x,
            ppts[i].y,
            ppts[i + 1].x,
            ppts[i + 1].y
        );
        ctx.stroke();
		
	};
    
    // Undo function: first blood, part three! Here, we have the final piece of the undo-ing puzzle. 
    // This initiates clearing the drawing piece from the canvas, but without clearing the entire canvas 
    // each time the user hits UNDO.
    var UndoFunc = function(count) {
        
        var number = undo_arr.length;
        var img_data = undo_arr[number - (count + 1)];
        var undo_img = new Image();
        
        undo_img.src = img_data.toString();
        
        ctx.clearRect(0, 0, tmp_canvas.width, tmp_canvas.height);
        ctx.drawImage(undo_img, 0, 0);
        
    };
    
    // Download function: Allows the user to download their artwork! This function works by using a 
    // series of small functions. We begin by setting a function to call the download as a file called
    // 'myOekaki.png'. We then set an off-screen anchor tag to allow us to set the attribute of the "a" tag
    // in a link. After that, we tell the canvas content to be converted to a data URL, which will be
    // pushed as a download by the browser once the event is fired off (in this case, as a click).
    
  var callDownload = function() {
		download(paint,'myOekaki.png');
		};
    
    document.getElementById("id_download").addEventListener("click", callDownload);
        
        function download(canvas, filename) {
            
            // Create an off-screen anchor tag:
            var lnk = document.createElement('a'),
                e;
            
            // Set the download attribute of the "a" tag...
            lnk.download = filename;
            
            // Set the canvas content to be converted to a data URL. With the attribute set,
            // the content pointed to by the link will be pushed as a download by the browser.
            lnk.href= canvas.toDataURL();
            
            // This sets up a base click event to trigger the download!
            if (document.createEvent) {
                
                e = document.createEvent("MouseEvents");
                e.initMouseEvent("click", true, true, window, 
                                 0, 0, 0, 0, 0, false, false, 
                                 false, false, 0, null);
                
            lnk.dispatchEvent(e);
                
            } else if (lnk.fireEvent) {
                
                lnk.fireEvent("onclick");
                
            }
        };     
        
}());