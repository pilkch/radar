function clamp(num, min, max) {
  return num <= min ? min : num >= max ? max : num;
}

function calculateAngleToPoint(point) {
  // https://stackoverflow.com/questions/9614109/how-to-calculate-an-angle-from-points
  var origin = { x:0, y:0 };
  var dy = point.y - origin.y;
  var dx = point.x - origin.x;
  var theta = Math.atan2(dy, dx); // range (-pi, pi]
  theta *= 180 / Math.PI; // rads to degs, range (-180, 180]
  return theta;
}

var radar = document.getElementById( 'radar' ), 
padding = 14,
diameter = Math.min(window.innerWidth, window.innerHeight) - (2 * padding),
radius = diameter / 2,
ctx = Sketch.create({
  container: radar,
  fullscreen: false,
  width: diameter,
  height: diameter
}),
dToR = function( degrees ){ 
  return degrees * (Math.PI / 180);
},
sweepAngle = 270,
sweepSize = 2,
sweepSpeed = 1.2,
rings = 4,
hueStart = 120,
hueEnd = 170,
hueDiff = Math.abs( hueEnd - hueStart ),
saturation = 50,
lightness = 40,
lineWidth = 2,
gradient = ctx.createLinearGradient( radius, 0, 0, 0 );


radar.style.marginLeft = radar.style.marginTop = ( -diameter / 2 ) - padding + 'px';
gradient.addColorStop( 0, 'hsla( ' + hueStart + ', ' + saturation + '%, ' + lightness + '%, 1 )' );
gradient.addColorStop( 1, 'hsla( ' + hueEnd + ', ' + saturation + '%, ' + lightness + '%, 0.1 )' );

var renderRings = function(){
  var i;
  for( i = 0; i < rings; i++ ){
    ctx.beginPath();
    ctx.arc( radius, radius, ( ( radius - ( lineWidth / 2) ) / rings) * ( i + 1 ), 0, TWO_PI, false );
    ctx.strokeStyle = 'hsla(' + ( hueEnd - ( i * ( hueDiff / rings ) ) ) + ', ' + saturation + '%, ' + lightness + '%, 0.1)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };
};

var renderGrid = function(){
  ctx.beginPath();
  ctx.moveTo( radius - lineWidth / 2, lineWidth );
  ctx.lineTo( radius - lineWidth / 2, diameter - lineWidth );
  ctx.moveTo( lineWidth, radius - lineWidth / 2 );
  ctx.lineTo( diameter - lineWidth, radius - lineWidth / 2 );
  ctx.strokeStyle = 'hsla( ' + ( ( hueStart + hueEnd ) / 2) + ', ' + saturation + '%, ' + lightness + '%, .03 )';
  ctx.stroke();
};

var renderSweep = function(){
  ctx.save();
  ctx.translate( radius, radius );
  ctx.rotate( dToR(sweepAngle) );  
  ctx.beginPath();
  ctx.moveTo( 0, 0 );
  ctx.arc( 0, 0, radius, dToR( -sweepSize ), dToR( sweepSize ), false );
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();  
  ctx.restore();
};

var renderScanLines = function(){
  var i;
  ctx.beginPath();
  for( i = 0; i < diameter; i += 2 ){    
    ctx.moveTo( 0, i + .5 );
    ctx.lineTo( diameter, i + .5);
  };
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'hsla( 0, 0%, 0%, .02 )';
  ctx.globalCompositeOperation = 'source-over';
  ctx.stroke();
};

var targets = [];

var maxBlips = 2;
var fadeOutTime = 600;

var renderTargets = function() {
  var time = window.performance.now();

  ctx.globalCompositeOperation = 'source-over';

  var len = targets.length;
  for(var i = 0; i < len; i++) {
    var lastBlip = targets[i].lastBlip;
    if (lastBlip != 0) {
      var x = radius + targets[i].x;
      var y = radius + targets[i].y;

      var targetRadius = 0.04 * radius;

      var hue = 127;
      var saturation = 100;
      var lightness = 69;
      var alpha_fade = clamp(fadeOutTime - (time - lastBlip), 0.0, 1.0);
      var alpha1 = alpha_fade * 0.2;
      var alpha2 = alpha_fade * 0.1;

      ctx.beginPath();
      ctx.arc(x, y, targetRadius, 0, 2 * Math.PI, false);
      ctx.fillStyle = 'hsla( ' + hue + ', ' + saturation + '%, ' + lightness + '%, ' + alpha1 + ' )';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'hsla( ' + hue + ', ' + saturation + '%, ' + lightness + '%, ' + alpha1 + ' )';
      ctx.stroke();
    }
  }
};

ctx.clear = function(){
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'hsla( 0, 0%, 0%, 0.1 )';
  ctx.fillRect( 0, 0, diameter, diameter );
};

// Add event listener for `click` events.
ctx.container.addEventListener('click', function(event) {
  var elemLeft = ctx.container.offsetLeft;
  var elemTop = ctx.container.offsetTop;

  var offsetX = event.pageX - elemLeft;
  var offsetY = event.pageY - elemTop;

  // Subtract the radius to get a target it the range -radius to +radius
  var pointX = offsetX - radius;
  var pointY = offsetY - radius;

  targets.push({ x:pointX, y:pointY, lastBlip:0, blips:0 });

}, false);

ctx.update = function(){
  var time = window.performance.now();

  // Check if we have just passed over a target
  var len = targets.length;
  for(var i = 0; i < len; i++) {
    // NOTE: We add 180 degrees to keep the range positive and away from the boundary at 0
    var angleToTarget = calculateAngleToPoint(targets[i]) + 180.0;

    // Start playing a sound just before we get there so that it is playing as we hit, by checking against a slightly advanced sweep angle
    var startPlayingOffset = 35.0;
    var advancedSweepAngle0 = (sweepAngle + startPlayingOffset + 180.0) % 360.0;
    var advancedSweepAngle1 = (sweepAngle + startPlayingOffset + sweepSpeed + 180.0) % 360.0;
    if ((angleToTarget > advancedSweepAngle0) && (angleToTarget < advancedSweepAngle1)) {
      // Play a blip sound
      playBlipSound();
    }

    var sweepAngle0 = (sweepAngle + 180.0) % 360.0;
    var sweepAngle1 = (sweepAngle + sweepSpeed + 180.0) % 360.0;
    if ((angleToTarget > sweepAngle0) && (angleToTarget < sweepAngle1)) {
      // Update the time that the sweep hit the target
      targets[i].lastBlip = time;

      // Increment the blips
      targets[i].blips++;
    }
  }

  // Remove any targets where we have blipped enough and also finished our last fade out time
  targets = targets.filter(target => !((target.blips > maxBlips) && ((time - target.lastBlip) > fadeOutTime)));

  sweepAngle += sweepSpeed;
};

ctx.draw = function(){
  ctx.globalCompositeOperation = 'lighter';
  renderRings();
  renderGrid();
  renderSweep();
  renderTargets();
  renderScanLines();
};
