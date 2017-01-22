var w = c.width = window.innerWidth;
var h = c.height = window.innerHeight;
var ctx = c.getContext('2d');

var opts = {
	color: 'hsl(hue,100%,light%)',
	cx: w / 2,
	cy: h / 2,
};

var custom_fade_rate = 1.0;
var custom_decay_factor = 1.0;
var custom_speed_factor = 1.0;
var custom_max_lines = 300;
var custom_scale_factor = 1.0;
var custom_pattern_size = 1.0;
var custom_glowing_factor = 1.0;
var custom_color_changing = 1.0;
var custom_color_changing_old = 1.0;
var custom_spawn_origin = 1;
var custom_use_lines = false;
var custom_use_sparkles = false;
var custom_audio_pulse_inverse_color = false;

// Position, size and color
var scale_factor = (w > 1200 && h > 800) ? Math.sqrt(w / 1200.0 * h / 800.0) : 1.0;
var hex_side_length = 40 * scale_factor * custom_scale_factor;
var point_size = scale_factor * custom_scale_factor * 2 * custom_pattern_size;
var tick = 0;
var color0 = 0;
var lines = [];
var special_lines = [];
var dieX = w / 2 / hex_side_length;
var dieY = h / 2 / hex_side_length;
var baseRad = Math.PI * 2 / 6;
var unit_cell_w = 3;
var unit_cell_h = Math.sqrt(3);
var sqrt3 = Math.sqrt(3);
var crit_len = 1.7;
var hex_x_list = [1, 0.5, -0.5, -1, -0.5, 0.5];
var hex_y_list = [0, sqrt3 / 2, sqrt3 / 2, 0, -sqrt3 / 2, -sqrt3 / 2];
var hex_rad_list = [0, 1, 2, 3, 4, 5]; // How many baseRad(s)

// Event timer
var last_time_explosion = 0;
var explosion_lock = false;
var last_time_sporadic = 0;
var sporadic_interval = (Math.random() * 260 + 100) | 0;
var sporadic_duration = (Math.random() * 200 + 100) | 0;
var sporadic_spawning = false;
var sporadic_min_dist = 20;

// Audio sample
var audio_lf = 0;
var audio_hf = 0;

// Spawn Loc
var mouse_x = opts.cx;
var mouse_y = opts.cy;
var random_spawn_x = opts.cx;
var random_spawn_y = opts.cy;
var last_time_change_random_spawn = 0;
var change_random_spawn_interval = (Math.random() * 500 + 1000) | 0;
var sporadic_spawn_x = opts.cx;
var sporadic_spawn_y = opts.cy;

ctx.fillStyle = 'black';
ctx.fillRect(0, 0, w, h);

var update_globals = function () {
	hex_side_length = 40 * scale_factor * custom_scale_factor;
	point_size = scale_factor * custom_scale_factor * 2 * custom_pattern_size;
	dieX = w / 2 / hex_side_length;
	dieY = h / 2 / hex_side_length;
}

c.onmousemove = function (e) {
	mouse_x = e.pageX;
	mouse_y = e.pageY;
}

var audioMaxSample = 10;
var audioSample_lf = 0;
var audioSample_hf = 0;
var audioProcess = function (sample) {
	audio_lf = audio_hf = 0;
	half_sample = sample.length / 4;
	for (var i = 0; i < half_sample; i++) {
		audio_lf += sample[i] + sample[i + 2 * half_sample];
		audio_hf += sample[i + half_sample] + sample[i + 3 * half_sample];
	}
	audioSample_lf = ((audioMaxSample - 1) * audioSample_lf + audio_lf) / audioMaxSample;
	audioSample_hf = ((audioMaxSample - 1) * audioSample_hf + audio_hf) / audioMaxSample;
}
window.wallpaperRegisterAudioListener(audioProcess);

window.wallpaperPropertyListener = {
	applyUserProperties: function (properties) {
		if (properties.custom_spawn_origin) {
			custom_spawn_origin = properties.custom_spawn_origin.value;
		}
		if (properties.custom_use_lines) {
			custom_use_lines = properties.custom_use_lines.value;
		}
        if (properties.custom_use_sparkles) {
			custom_use_sparkles = properties.custom_use_sparkles.value;
		}
		if (properties.custom_scale_factor) {
			custom_scale_factor = properties.custom_scale_factor.value / 100.0;
			update_globals();
		}
		if (properties.custom_max_lines) {
			custom_max_lines = properties.custom_max_lines.value;
		}
		if (properties.custom_fade_rate) {
			custom_fade_rate = properties.custom_fade_rate.value / 100.0;
		}
		if (properties.custom_pattern_size) {
			custom_pattern_size = properties.custom_pattern_size.value / 100.0;
			update_globals();
		}
		if (properties.custom_glowing_factor) {
			custom_glowing_factor = properties.custom_glowing_factor.value / 100.0;
		}
		if (properties.custom_decay_factor) {
			custom_decay_factor = properties.custom_decay_factor.value / 100.0;
		}
		if (properties.custom_speed_factor) {
			custom_speed_factor = properties.custom_speed_factor.value / 100.0;
		}
		if (properties.custom_color_changing) {
			custom_color_changing = properties.custom_color_changing.value / 100.0;
			color0 += 0.1 * tick * (custom_color_changing_old - custom_color_changing);
			custom_color_changing_old = custom_color_changing;
		}
		if (properties.custom_audio_pulse_inverse_color) {
			custom_audio_pulse_inverse_color = properties.custom_audio_pulse_inverse_color.value;
		}
	}
};

var dist = function (x1, y1, x2, y2) {
	return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
}

function loop() {
	window.requestAnimationFrame(loop);

	++tick;

	ctx.globalCompositeOperation = 'source-over';
	ctx.shadowBlur = 0;
	ctx.fillStyle = 'rgba(0,0,0,alp)'.replace('alp', 0.036 * (custom_fade_rate));
	ctx.fillRect(0, 0, w, h);

	ctx.globalCompositeOperation = 'lighter';

	if (lines.length < custom_max_lines && Math.random() < 1) {
		lines.push(new Line("normal"));
	}
	if (!explosion_lock && audio_lf + audio_hf > 29 && audio_lf + audio_hf > (audioSample_lf + audioSample_hf) * 1.5 && tick - last_time_explosion > 20) {
		// Explosion
		for (var i = 0; i < 100; i++)
			special_lines.push(new Line("explosion"));
		last_time_explosion = tick;
		explosion_lock = true;
	}
	if (explosion_lock && audioSample_hf + audioSample_lf < 25)
		explosion_lock = false;
	if (sporadic_spawning || (Math.random() < 0.1 && audio_lf == 0 && audio_hf == 0 && tick - last_time_sporadic > sporadic_interval)) {
		// Sporadic spawn
		if (!sporadic_spawning) {
			sporadic_spawn_x = Math.random() * w;
			sporadic_spawn_y = Math.random() * h;
			switch (custom_spawn_origin) {
			case 1:
				if (dist(sporadic_spawn_x, sporadic_spawn_y, mouse_x, mouse_y) > sporadic_min_dist * hex_side_length) {
					sporadic_spawning = true;
					last_time_sporadic = tick;
				}
				break;
			case 2:
				if (dist(sporadic_spawn_x, sporadic_spawn_y, opts.cx, opts.cy) > sporadic_min_dist * hex_side_length) {
					sporadic_spawning = true;
					last_time_sporadic = tick;
				}
				break;
			case 3:
				if (dist(sporadic_spawn_x, sporadic_spawn_y, random_spawn_x, random_spawn_y) > sporadic_min_dist * hex_side_length) {
					sporadic_spawning = true;
					last_time_sporadic = tick;
				}
				break;
			}

		}
		if (sporadic_spawning) {
			special_lines.push(new Line("sporadic"));
			if (tick - last_time_sporadic > sporadic_duration) {
				sporadic_spawning = false;
				sporadic_interval = (Math.random() * 260 + 100) | 0;
				sporadic_duration = (Math.random() * 200 + 100) | 0;
				last_time_sporadic = tick;
			}
		}
	}

	var index = 0;
	while (index < lines.length) {
		lines[index].step();
		if (lines[index].finished) {
			lines.splice(index, 1);
		} else
			++index;
	}
	var index = 0;
	while (index < special_lines.length) {
		special_lines[index].step();
		if (special_lines[index].finished) {
			special_lines.splice(index, 1);
		} else
			++index;
	}

}

function Line(mode) {
	this.reset(mode);
}

Line.prototype.reset = function (mode) {

	this.mode = mode;
	this.lifespan = (300.0 / custom_decay_factor) | 0;
	if (this.mode == "sporadic")
		this.lifespan = (600.0 / custom_decay_factor) | 0;

	this.finished = false;

	var rel_x;
    var rel_y;
	switch (custom_spawn_origin) {
	case 1:
		rel_x = (mouse_x - opts.cx) / hex_side_length;
		rel_y = (mouse_y - opts.cy) / hex_side_length;
		break;
	case 2:
		rel_x = rel_y = 0;
		break;
	case 3:
		if (tick - last_time_change_random_spawn > change_random_spawn_interval) {
			random_spawn_x = Math.random() * w;
			random_spawn_y = Math.random() * h;
			last_time_change_random_spawn = tick;
			change_random_spawn_interval = (Math.random() * 500 + 1000) | 0;
		}
		rel_x = (random_spawn_x - opts.cx) / hex_side_length;
		rel_y = (random_spawn_y - opts.cy) / hex_side_length;
	}

	this.origin_x = rel_x;
	this.origin_y = rel_y;
	if (this.mode == "sporadic") {
		rel_x = (sporadic_spawn_x - opts.cx) / hex_side_length;
		rel_y = (sporadic_spawn_y - opts.cy) / hex_side_length;
	}

	var cell_x = Math.floor(rel_x / unit_cell_w);
	var cell_y = Math.floor(rel_y / unit_cell_h);
	var incell_x = rel_x - cell_x * unit_cell_w;
	var incell_y = rel_y - cell_y * unit_cell_h;
	var hex_mid_x = 0;
	var hex_mid_y = 0;
	if (incell_y > sqrt3 * incell_x && incell_y < -sqrt3 * incell_x + sqrt3) {
		hex_mid_x = cell_x * unit_cell_w - 0.5;
		hex_mid_y = cell_y * unit_cell_h + sqrt3 / 2;
	} else if (incell_y >= -sqrt3 * incell_x + sqrt3 * 2 && incell_y <= sqrt3 * incell_x - sqrt3) {
		hex_mid_x = cell_x * unit_cell_w + 2.5;
		hex_mid_y = cell_y * unit_cell_h + sqrt3 / 2;
	} else if (incell_y >= sqrt3 / 2) {
		hex_mid_x = cell_x * unit_cell_w + 1;
		hex_mid_y = cell_y * unit_cell_h + sqrt3;
	} else {
		hex_mid_x = cell_x * unit_cell_w + 1;
		hex_mid_y = cell_y * unit_cell_h;
	}

	hex_point_index = (custom_spawn_origin == 2 ? 3 : (Math.random() * 6) | 0);
	this.x = hex_x_list[hex_point_index] + hex_mid_x;
	this.y = hex_y_list[hex_point_index] + hex_mid_y;
	this.last_loc_x = opts.cx + this.x * hex_side_length;
	this.last_loc_y = opts.cy + this.y * hex_side_length;
	this.addedX = 0;
	this.addedY = 0;

	this.rad = baseRad * ((Math.random() * 3 | 0) * 2 + 1 + hex_rad_list[hex_point_index]);
	this.shaking = 0;

	this.lightInputMultiplier = .01 + .02 * Math.random();
	if (this.mode == "sporadic")
		this.lightInputMultiplier = .03 + .03 * Math.random();

	this.color = opts.color.replace('hue', tick * .10 * custom_color_changing + color0 + ((custom_audio_pulse_inverse_color && this.mode == "explosion") ? 180 : 0));
	this.cumulativeTime = 0;

	this.beginPhase();
}

Line.prototype.beginPhase = function () {

	this.x += this.addedX;
	this.y += this.addedY;

	this.time = 0;
	if (this.mode == "explosion")
		this.targetTime = ((4 + 2 * Math.random()) / custom_speed_factor) | 0;
	else if (this.mode == "sporadic")
		this.targetTime = ((25 + 25 * Math.random()) / custom_speed_factor) | 0;
	else
		this.targetTime = ((10 + 10 * Math.random()) / custom_speed_factor) | 0;

	var tot_rad = Math.atan2(this.y - this.origin_y, this.x - this.origin_x);
	var p1 = Math.cos(this.rad + baseRad - tot_rad);
	var p2 = Math.cos(this.rad - baseRad - tot_rad);
	var p = 1.0 * (p1 + 1) / (p1 + p2 + 2);
	if (this.mode == "sporadic")
		p = 1.0 * (p1 + 2.5) / (p1 + p2 + 5);
	if (this.x == this.origin_x && this.y == this.origin_y)
		p = 0.5;
	this.rad += baseRad * (Math.random() < p ? 1 : -1);
	this.addedX = Math.cos(this.rad);
	this.addedY = Math.sin(this.rad);

	if (Math.random() < .015 || this.cumulativeTime >= this.lifespan || this.x > dieX || this.x < -dieX || this.y > dieY || this.y < -dieY)
		this.finished = true;
}

Line.prototype.step = function () {

	++this.time;
	++this.cumulativeTime;

	if (this.time >= this.targetTime)
		this.beginPhase();

	var prop = this.time / this.targetTime,
	wave = Math.sin(prop * Math.PI / 2),
	x = this.addedX * wave,
	y = this.addedY * wave;

	var decay_factor = Math.exp(-this.cumulativeTime / 90.0 * custom_decay_factor);
	var brightness = ((custom_use_lines ? 20 : 30) + 10 * Math.sin(this.cumulativeTime * this.lightInputMultiplier) + (audio_hf + 0.2 * audio_lf) * 7.0) * decay_factor;
	ctx.shadowBlur = prop * 12 * custom_scale_factor * custom_glowing_factor;

	if (this.mode == "explosion") {
		decay_factor = Math.exp(-this.cumulativeTime / (custom_use_lines ? 30.0 : 40.0) * custom_decay_factor);
		brightness = (100) * decay_factor;
	} else if (this.mode == "sporadic") {
		decay_factor = Math.exp(-this.cumulativeTime / 175.0 * custom_decay_factor);
		brightness = (6 + 2 * Math.sin(this.cumulativeTime * this.lightInputMultiplier)) * decay_factor;
	}

	ctx.fillStyle = ctx.shadowColor = this.color.replace('light', brightness);
	var actual_pos_x = opts.cx + (this.x + x) * hex_side_length;
	var actual_pos_y = opts.cy + (this.y + y) * hex_side_length;
	var shaking = hex_side_length * ((audio_lf + 0.2 * audio_hf) / 32.0) * Math.random() * (Math.random() < 0.5 ? 1 : -1) * decay_factor;
	if (shaking < this.shaking - 0.08 * hex_side_length) {
		this.shaking -= 0.08 * hex_side_length;
	} else if (shaking > this.shaking + 0.08 * hex_side_length) {
		this.shaking += 0.08 * hex_side_length;
	} else {
		this.shaking = shaking;
	}

	var point_size_normal = point_size * (audio_hf / 40 + 1);
	if (this.mode == "sporadic") {
		this.shaking = 0;
		point_size_normal = point_size;
	}
	var this_loc_x = actual_pos_x + Math.sin(this.rad) * this.shaking;
	var this_loc_y = actual_pos_y + Math.cos(this.rad) * this.shaking;
	if (custom_use_lines) {
		ctx.beginPath();
		ctx.strokeStyle = ctx.fillStyle;
		ctx.lineWidth = point_size_normal;
		ctx.moveTo(this.last_loc_x, this.last_loc_y);
		ctx.lineTo(this_loc_x, this_loc_y);
		ctx.stroke();
	} else {
		ctx.fillRect(this_loc_x, this_loc_y, point_size_normal, point_size_normal);
	}

	if (custom_use_sparkles && Math.random() < (.1 + shaking / 2.0 / hex_side_length) * custom_scale_factor)
		ctx.fillRect(actual_pos_x + Math.random() * (hex_side_length / 2 + shaking) * (Math.random() < .5 ? 1 : -1), actual_pos_y + Math.random() * (hex_side_length / 2 + shaking) * (Math.random() < .5 ? 1 : -1), point_size, point_size);

	this.last_loc_x = this_loc_x;
	this.last_loc_y = this_loc_y;
}

loop();

window.addEventListener('resize', function () {

	w = c.width = window.innerWidth;
	h = c.height = window.innerHeight;
	scale_factor = (w > 1200 && h > 800) ? Math.sqrt(w / 1200.0 * h / 800.0) : 1.0;
	update_globals();

	ctx.fillStyle = 'black';
	ctx.fillRect(0, 0, w, h);

	opts.cx = w / 2;
	opts.cy = h / 2;

});
