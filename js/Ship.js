var HID = require('./components/Hid');
var Damage = require('./components/Damage');
var destroyMesh = require('./utils/destroyMesh');

var Ship = function( poem ) {
	
	this.poem = poem;
	this.scene = poem.scene;
	this.polarObj = new THREE.Object3D();
	this.object = null;
	this.hid = new HID( this.poem );
	this.color = 0x4A9DE7;
	this.linewidth = 2 * this.poem.ratio;
	this.radius = 3;
	
	this.position = new THREE.Vector2();	
	
	this.dead = false;
	this.killTimeout = null;
	this.lives = 3;
	this.invulnerable = true;
	this.invulnerableLength = 3000;
	this.invulnerableTime = 0 + this.invulnerableLength;
	this.invulnerableflipFlop = false;
	this.invulnerableflipFlopLength = 100;
	this.invulnerableflipFlopTime = 0;
	
	this.speed = 0;
	
	this.edgeAvoidanceBankSpeed = 0.04;
	this.edgeAvoidanceThrustSpeed = 0.001;
	
	this.thrustSpeed = 0.001;
	this.thrust = 0;
	
	this.bankSpeed = 0.06;
	this.bankSpeed = 0.0075;
	this.bank = 0;
	this.maxSpeed = 500;

	this.addObject();
	this.damage = new Damage(this.poem, {
		color: this.color
	});
	
	this.poem.on('update', this.update.bind(this) );
	
};

module.exports = Ship;

Ship.prototype = {
	
	createGeometry : function() {
		
		var geometry, verts, manhattanLength, center;
		
		geometry = new THREE.Geometry();
		
		verts = [[50,36.9], [39.8,59.6], [47.1,53.9], [50,57.5], [53,53.9], [60.2,59.6], [50,36.9]];

		manhattanLength = _.reduce( verts, function( memo, vert2d ) {
			
			return [memo[0] + vert2d[0], memo[1] + vert2d[1]];
			
		}, [0,0]);
		
		center = [
			manhattanLength[0] / verts.length,
			manhattanLength[1] / verts.length
		];
		
		geometry.vertices = _.map( verts, function( vec2 ) {
			var scale = 1 / 4;
			return new THREE.Vector3(
				(vec2[1] - center[1]) * scale * -1,
				(vec2[0] - center[0]) * scale,
				0
			);
		});
		
		return geometry;
		
	},
	
	addObject : function() {
		
		var geometry, lineMaterial;
		
		geometry = this.createGeometry();
				
		lineMaterial = new THREE.LineBasicMaterial({
			color: this.color,
			linewidth : this.linewidth
		});
		
		this.object = new THREE.Line(
			geometry,
			lineMaterial,
			THREE.LineStrip
		);
		this.object.position.z += this.poem.r;

		this.polarObj.add( this.object );
		this.reset();
		this.scene.add( this.polarObj );
		this.poem.on('destroy', destroyMesh( this.object ) );
		
	},
	
	disable : function() {
		clearTimeout( this.killTimeout );
		this.dead = true;
		this.object.visible = false;
	},
	
	kill : function( force ) {

		if( !force && !this.dead && !this.invulnerable ) {
			this.dead = true;
			this.object.visible = false;
			
			this.damage.explode( this.position );
			
			var lostPoints = Math.ceil( this.poem.scoringAndWinning.score / -2 );
			
			this.poem.scoringAndWinning.adjustScore(
				lostPoints,
				lostPoints + " points",
				{
					"font-size" : "2em",
					"color": "red"
				}
			);
		
			this.killTimeout = setTimeout(function() {
		
				this.dead = false;
				this.invulnerable = true;
				this.invulnerableTime = this.poem.clock.time + this.invulnerableLength;
				this.object.visible = true;
				this.reset();
		
			}.bind(this), 2000);
		}
	},
	
	reset : function() {
		this.position.x = 0;
		this.position.y = 0;
		this.speed = 0.2;
		this.bank = 0;
		//this.object.rotation.z = Math.PI * 0.25;		
	},
	
	update : function( e ) {
		
		if( this.dead ) {
			
			
		} else {
			
			this.updateThrustAndBank( e );
			this.updateEdgeAvoidance( e );
			this.updatePosition( e );
			this.updateFiring( e );
			this.updateInvulnerability( e );
			
		}
		this.damage.update( e );
		this.hid.update( e );
		
	},
	
	updateInvulnerability : function( e ) {
		
		if( this.invulnerable ) {
			
			if( e.time < this.invulnerableTime ) {
				
				
				if( e.time > this.invulnerableflipFlopTime ) {

					this.invulnerableflipFlopTime = e.time + this.invulnerableflipFlopLength;
					this.invulnerableflipFlop = !this.invulnerableflipFlop;	
					this.object.visible = this.invulnerableflipFlop;
					
				}
					
			} else {
				
				this.object.visible = true;
				this.invulnerable = false;
			}
			
		}
		
	},
	
	updateThrustAndBank : function( e ) {
		
		var pressed, tilt, theta, thetaDiff;
		
		this.bank *= 0.9;
		this.thrust = 0;
		
		if( this.hid.type() === "keys" ) {
			
			pressed = this.hid.pressed;
		
			if( pressed.up ) {
				this.thrust += this.thrustSpeed * e.dt;
			}
		
			if( pressed.down ) {
				this.thrust -= this.thrustSpeed * e.dt;	
			}
		
			if( pressed.left ) {
				this.bank += this.bankSpeed;
			}
		
			if( pressed.right ) {
				this.bank += this.bankSpeed * -1;
			}
			
		} else {
			tilt = this.hid.tilt;
			
			var distance = Math.sqrt(tilt.x * tilt.x + tilt.y * tilt.y);
		
			this.thrust = Math.min( 0.0011, distance / 10000 );
			
			this.thrust *= e.dt;
			
			theta = Math.atan2( tilt.y, tilt.x );
			thetaDiff = (theta - this.object.rotation.z) % (2 * Math.PI);
			
			if( thetaDiff > Math.PI ) {
				thetaDiff -= 2 * Math.PI;
			} else if ( thetaDiff < -Math.PI ) {
				thetaDiff += 2 * Math.PI;
			}
			
			this.bank = thetaDiff * distance / 2500 * e.dt;
			
			
		}
	},
	
	updateEdgeAvoidance : function( e ) {
		
		var nearEdge, farEdge, position, normalizedEdgePosition, bankDirection, absPosition;
		
		farEdge = this.poem.height / 2;
		nearEdge = 4 / 5 * farEdge;
		position = this.object.position.y;
		absPosition = Math.abs( position );

		var rotation = this.object.rotation.z / Math.PI;

		this.object.rotation.z %= 2 * Math.PI;
		
		if( this.object.rotation.z < 0 ) {
			this.object.rotation.z += 2 * Math.PI;
		}
		
		if( Math.abs( position ) > nearEdge ) {
			
			var isPointingLeft = this.object.rotation.z >= Math.PI * 0.5 && this.object.rotation.z < Math.PI * 1.5;
			
			if( position > 0 ) {
				
				if( isPointingLeft ) {
					bankDirection = 1;
				} else {
					bankDirection = -1;
				}
			} else {
				if( isPointingLeft ) {
					bankDirection = -1;
				} else {
					bankDirection = 1;
				}
			}
			
			normalizedEdgePosition = (absPosition - nearEdge) / (farEdge - nearEdge);
			this.thrust += normalizedEdgePosition * this.edgeAvoidanceThrustSpeed;
			this.object.rotation.z += bankDirection * normalizedEdgePosition * this.edgeAvoidanceBankSpeed;
			
		}
		
	},
	
	updateFiring : function( e ) {
		if( this.hid.pressed.spacebar ) {
			this.poem.gun.fire( this.position.x, this.position.y, 2, this.object.rotation.z );
		}
	},
	
	updatePosition : function() {
		
		var movement = new THREE.Vector3();
		
		return function( e ) {
		
			var theta, x, y;
			
			this.object.rotation.z += this.bank;
			
			theta = this.object.rotation.z;
			
			this.speed *= 0.98;
			this.speed += this.thrust;
			this.speed = Math.min( this.maxSpeed, this.speed );
			this.speed = Math.max( 0, this.speed );
						
			this.position.x += this.speed * Math.cos( theta );
			this.position.y += this.speed * Math.sin( theta );
			
			this.object.position.y = this.position.y;
			
			//Polar coordinates
			this.polarObj.rotation.y = this.position.x * this.poem.circumferenceRatio;
			
		};
		
	}(),
	
	destroy : function() {
		this.object.geometry.dispose();
		this.object.material.dispose();
	}
	
};