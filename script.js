let simrate = 60, framerate = 144;

const bgcanvas = document.getElementsByTagName('canvas')[0],
    bgctx = bgcanvas.getContext('2d'),
    canvas = document.getElementsByTagName('canvas')[1],
    ctx = canvas.getContext('2d'),
    entities = new Map(),
    mouseMap = new Map(),
    keysMap = new Map();

// this feels like bad coding
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
bgcanvas.width = bgcanvas.clientWidth;
bgcanvas.height = bgcanvas.clientHeight;
ctx.imageSmoothingEnabled = true;
bgctx.imageSmoothingEnabled = false;

const clamp = (v, min, max) => v > max ? max : v < min ? min : v;
const eqWMargin = (v1, v2, m) => Math.abs(v1 - v2) <= m;

// Using these functions we can have the canvas anywhere and still render correct (?)
const canvasBounds = canvas.getBoundingClientRect();
const sXcX = (sx) => sx - canvasBounds.left, // screen X -> canvas X
    sYcY = (sy) => sy - canvasBounds.top, // screen Y -> canvas Y
    cXsX = (cx) => cx + canvasBounds.left, // client X -> screen X
    cYsY = (cy) => cy + canvasBounds.top; // client Y -> screen Y

let gmouseX, gmouseY, // global mouse pos
    mouseX, mouseY; // canvas mouse pos
document.addEventListener('mousemove', e => {
    gmouseX = e.x;
    gmouseY = e.y;
    mouseX = sXcX(e.x);
    mouseY = sYcY(e.y);
});

const clickHandler = e => {
    player.fire();
}

function getLineIntersection(line1, line2) {
    if ((line1.x1 === line1.x2 && line1.y1 === line1.y2) || (line2.x1 === line2.x2 && line2.y1 === line2.y2)) return false;

    let denominator = ((line2.y2 - line2.y1) * (line1.x2 - line1.x1) - (line2.x2 - line2.x1) * (line1.y2 - line1.y1));

    // Lines are parallel
    if (denominator === 0) return false;

    let ua = ((line2.x2 - line2.x1) * (line1.y1 - line2.y1) - (line2.y2 - line2.y1) * (line1.x1 - line2.x1)) / denominator,
        ub = ((line1.x2 - line1.x1) * (line1.y1 - line2.y1) - (line1.y2 - line1.y1) * (line1.x1 - line2.x1)) / denominator;

    // is the intersection along the segments
    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return false;

    // Return a object with the x and y coordinates of the intersection
    let x = line1.x1 + ua * (line1.x2 - line1.x1),
        y = line1.y1 + ua * (line1.y2 - line1.y1);

    return { x, y };
}

document.addEventListener('mousedown', e => mouseMap.set(e.button, true));
document.addEventListener('mouseup', e => mouseMap.delete(e.button));
document.addEventListener('click', clickHandler);

document.addEventListener('keydown', e => keysMap.set(e.key, true));
document.addEventListener('keyup', e => keysMap.delete(e.key));

class Projectile {
    static validInitTypes = ['bullet', 'mine', 'rocket'];

    constructor(parent, type) {
        type = type.toLowerCase();
        if (!Projectile.validInitTypes.includes(type)) return;
        this.x = parent.x;
        this.y = parent.y;
        this.type = type;
        this.parentType = typeof parent;
        this.v_base = 0;
        this.v_x = 0;
        this.v_y = 0;
        this.bounces = 0;
        this.size = 8;
        this.armTime = performance.now() + 300;
        if (this.type === 'rocket') {
            this.v_base = 16;
            this.v_x = this.v_base * Math.cos(parent.barrelYaw);
            this.v_y = this.v_base * Math.sin(parent.barrelYaw);
            this.bounces = 2;
        } else if (this.type === 'bullet') {
            this.v_base = 9;
            this.v_x = this.v_base * Math.cos(parent.barrelYaw);
            this.v_y = this.v_base * Math.sin(parent.barrelYaw);
            this.bounces = parent.type === 'bounce' ? 1 : 0;
        } else if (this.type === 'mine') {
            this.size = 6;
            this.armTime = performance.now() + 2000;
        }
        this.fuse = -1;
        this.animState = { anim: null, prog: 0 };
        this.detonated = false;
        this.id = Math.random().toString(36).replace('0.', '');
        entities.set(this.id, this);
    }

    render() {
        if (this.type === 'rocket' || this.type === 'bullet') {
            ctx.save();
            ctx.translate(this.x, this.y);
            if (this.v_x === 0 || this.v_y === 0) {
                circle(this.x, this.y, this.size * 0.4);
            } else {
                ctx.rotate(Math.atan2(this.v_y, this.v_x));
                if (this.type === 'rocket') {
                    ctx.fillStyle = '#ff6a00';
                    ctx.beginPath();
                    ctx.moveTo(this.size * -0.4, this.size * -0.2);
                    ctx.lineTo(this.size * -1.9, 0);
                    ctx.lineTo(this.size * -0.4, this.size * 0.2);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.fillStyle = this.type === 'rocket' ? '#068a57' : '#021247';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(this.size * -0.4, this.size * -0.2);
                ctx.lineTo(this.size * -1, this.size * -0.2);
                ctx.lineTo(this.size * -1, this.size * 0.2);
                ctx.lineTo(this.size * -0.4, this.size * 0.2);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        } else if (this.type === 'mine') {
            if (this.armTime >= performance.now()) { // Not armed
                if (performance.now() % 500 < 125) ctx.fillStyle = '#ff0000';
                else ctx.fillStyle = '#c6cc12';
            } else if (this.fuse < 0) { // Not triggered
                if (performance.now() % 300 < 75) ctx.fillStyle = '#ff0000';
                else ctx.fillStyle = '#c6cc12';
            } else if (this.fuse > 0) { // Triggered
                if (performance.now() % 150 < 40) ctx.fillStyle = '#ff0000';
                else ctx.fillStyle = '#c6cc12';
            }
            circle(this.x, this.y, this.size);
        }
        switch (this.animState.anim) {
            case 'explode':
                this.animState.prog++;
                ctx.fillStyle = '#ffcccc';
                circle(this.x, this.y, (this.size * 6) - (this.size * 3) / (this.animState.prog));
                if (this.animState.prog > 30) {
                    this.animState.anim = null;
                    this.detonated = true;
                }
                break;
        }
    }

    update() {
        if (this.detonated) return;
        if (this.fuse > 0) this.fuse--;
        else if (this.fuse === 0 && this.animState.anim !== 'explode') this.animState = { anim: 'explode', prog: 0 };

        if (this.y > canvas.height) {
            if (this.bounces > 0) {
                this.v_y *= -1;
                this.y = canvas.height;
                this.bounces--;
            } else {
                this.v_x = 0;
                this.v_y = 0;
                this.fuse = 0;
            }
        }
        if (this.y < 0) {
            if (this.bounces > 0) {
                this.v_y *= -1;
                this.y = 0;
                this.bounces--;
            } else {
                this.v_x = 0;
                this.v_y = 0;
                this.fuse = 0;
            }
        }
        if (this.x < 0) {
            if (this.bounces > 0) {
                this.v_x *= -1;
                this.x = 0;
                this.bounces--;
            } else {
                this.v_x = 0;
                this.v_y = 0;
                this.fuse = 0;
            }
        }
        if (this.x > canvas.width) {
            if (this.bounces > 0) {
                this.v_x *= -1;
                this.x = canvas.width;
                this.bounces--;
            } else {
                this.v_x = 0;
                this.v_y = 0;
                this.fuse = 0;
            }
        }

        for (let line of map) {
            if (getLineIntersection({ x1: this.x, y1: this.y, x2: this.x + this.v_x, y2: this.y + this.v_y }, line)) {
                if (this.bounces > 0) {
                    const l_a = Math.atan2(line.y2 - line.y1, line.x2 - line.x1),
                        n_x = Math.sin(l_a),
                        n_y = -Math.cos(l_a),
                        d = 2 * (this.v_x * n_x + this.v_y * n_y);
                    this.v_x -= d * n_x;
                    this.v_y -= d * n_y;
                    this.bounces--;
                } else {
                    this.fuse = 0;
                    this.v_x = 0;
                    this.v_y = 0;
                }
            }
        }

        this.x += this.v_x;
        this.y += this.v_y;

        entities.forEach(e => {
            if (e instanceof Tank) {
                if (this.armTime <= performance.now()) {
                    if (e.collide({ x1: this.x, y1: this.y, x2: this.x + this.v_x, y2: this.y + this.v_y })) {
                        this.v_x = 0;
                        this.v_y = 0;
                        if (this.fuse < 0) this.fuse = this.type === 'mine' ? 40 : 0;
                    }
                    if ((this.fuse === 0 && this.animState.prog < 5) &&
                        Math.hypot(this.x - e.x, this.y - e.y) < this.size * (this.fuse < 0 ? (this.type === 'mine' ? 1 : 0.2) : 3) + e.size * 0.8) e.destruct();

                    if (e.type !== 'player' && e.collide({ x1: this.x, y1: this.y, x2: this.x + this.v_x * this.v_base, y2: this.y + this.v_y * this.v_base })) e.incomingProjectile = this.id;
                }
            }
        });
    }

    destroy() {
        entities.delete(this.id);
    }
}

class Tank {
    static validInitTypes = ['player', 'common', 'fast', 'rocket', 'bounce'];

    constructor(x, y, type, flags) {
        type = type.toLowerCase();
        if (!Tank.validInitTypes.includes(type)) return;
        this.x = x;
        this.y = y;
        this.type = type;
        this.bodyYaw = 0; // radians
        this.bodySpeed = Math.PI / 32;
        this.barrelYaw = 0; // radians
        this.size = 40;
        this.speed = this.size * 0.1;
        this.tracks = [];
        this.lasttrack = 0;
        this.didMine = false;
        this.barrelHeat = 0;
        this.animState = { anim: null, prog: 0 };

        this.keyBinds = flags?.keyBinds || { front: null, back: null, clockwise: null, counterclockwise: null };
        this.moveStates = { front: false, back: false, clockwise: false, counterclockwise: false };

        // ai stuff?
        this.barrelTarget = null;
        this.barrelSpeed = Math.PI / 16;
        this.s_x = 0;
        this.s_y = 0;
        this.s_yaw = null;
        this.step_max = 0;
        this.step = 0;
        this.incomingProjectile = null;

        this.id = Math.random().toString(36).replace('0.', '');
        entities.set(this.id, this);
    }

    render() {
        let c_1 = '#000000', c_2 = '#000000'; // c_1 used for body, c_2 used for barrel; init to black
        switch (this.type) {
            case 'dead': // maybe todo: offload dead tanks to decal
                c_1 = '#777777';
                c_2 = '#333333';
                break;
            case 'player':
                c_1 = '#57abeb';
                c_2 = '#046ab8';
                break;
            case 'common':
                c_1 = '#e6d39a';
                c_2 = '#9c9580';
                break;
            case 'fast':
                c_1 = '#f96d00';
                c_2 = '#f2f2f2';
                break;
            case 'rocket':
                c_1 = '#00b012';
                c_2 = '#242424';
                break;
            case 'bounce':
                c_1 = '#3e4a61';
                c_2 = '#1a2639';
                break;
        }
        // do rendering of body
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.bodyYaw);
        ctx.fillStyle = c_1;
        ctx.fillRect(this.size * -0.5, this.size * -0.5, this.size, this.size);
        ctx.fillStyle = c_2;
        ctx.fillRect(this.size * -0.5 - this.size * 0.05, this.size * -0.5 - this.size * 0.05, this.size * 1.1, this.size * 0.3);
        ctx.fillRect(this.size * -0.5 - this.size * 0.05, this.size * 0.5 + this.size * 0.05, this.size * 1.1, this.size * -0.3);
        ctx.restore();

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.barrelYaw);
        ctx.fillStyle = c_2;
        ctx.fillRect(0, this.size * -0.1, this.size * 0.75, this.size * 0.2);
        ctx.fillStyle = c_2;
        circle(0, 0, this.size * 0.2);
        ctx.restore();

        switch (this.animState.anim) {
            case 'explode':
                this.animState.prog++;
                ctx.fillStyle = '#ffcccc';
                circle(this.x, this.y, this.size - this.size / (this.animState.prog));
                if (this.animState.prog > 30) this.animState.anim = null;
                break;
        }
    }

    bulletSim() {

    }

    getPath(target, bounces = 0) {
        let correctAngle
    }

    collide(line) {
        // this hurt brain :((
        let halfSize = this.size * 0.5,
            edges = [
                { x1: Math.cos(this.bodyYaw) * halfSize - Math.sin(this.bodyYaw) * halfSize, y1: Math.sin(this.bodyYaw) * halfSize + Math.cos(this.bodyYaw) * halfSize, x2: Math.cos(this.bodyYaw) * halfSize - Math.sin(this.bodyYaw) * -halfSize, y2: Math.sin(this.bodyYaw) * halfSize + Math.cos(this.bodyYaw) * -halfSize }, // ++, +-
                { x1: Math.cos(this.bodyYaw) * halfSize - Math.sin(this.bodyYaw) * -halfSize, y1: Math.sin(this.bodyYaw) * halfSize + Math.cos(this.bodyYaw) * -halfSize, x2: Math.cos(this.bodyYaw) * -halfSize - Math.sin(this.bodyYaw) * -halfSize, y2: Math.sin(this.bodyYaw) * -halfSize + Math.cos(this.bodyYaw) * -halfSize }, // +-, --
                { x1: Math.cos(this.bodyYaw) * -halfSize - Math.sin(this.bodyYaw) * -halfSize, y1: Math.sin(this.bodyYaw) * -halfSize + Math.cos(this.bodyYaw) * -halfSize, x2: Math.cos(this.bodyYaw) * -halfSize - Math.sin(this.bodyYaw) * halfSize, y2: Math.sin(this.bodyYaw) * -halfSize + Math.cos(this.bodyYaw) * halfSize }, // --, -+
                { x1: Math.cos(this.bodyYaw) * -halfSize - Math.sin(this.bodyYaw) * halfSize, y1: Math.sin(this.bodyYaw) * -halfSize + Math.cos(this.bodyYaw) * halfSize, x2: Math.cos(this.bodyYaw) * halfSize - Math.sin(this.bodyYaw) * halfSize, y2: Math.sin(this.bodyYaw) * halfSize + Math.cos(this.bodyYaw) * halfSize }  // -+, ++
            ];

        for (const edge of edges) {
            for (const key of Object.keys(edge)) {
                edge[key] += this[key.charAt(0)];
            }

            const res = getLineIntersection(edge, line);
            if (res) return res;
        }
        return false;
    }

    tankAI() {
        let target;
        entities.forEach(e => {
            if (e instanceof Tank) {
                if (e.type === 'player') return target = e;
            }
        });
        if (target) {
            // base bullet speed hardcoded at 16 or 9 pls fix
            let target_dist = Math.hypot(this.x - target.x, this.y - target.y),
                proj_speed = this.type === 'rocket' ? 16 : 9,
                t_x = target.x + (target.moveStates.back ? -1 : target.moveStates.front ? 1 : 0) * target.speed * (target_dist / proj_speed) * Math.cos(target.bodyYaw),
                t_y = target.y + (target.moveStates.back ? -1 : target.moveStates.front ? 1 : 0) * target.speed * (target_dist / proj_speed) * Math.sin(target.bodyYaw);

            let valid = true;
            for (let line of map) {
                if (getLineIntersection({ x1: target.x, y1: target.y, x2: t_x, y2: t_y }, line)) {
                    valid = false;
                    break;
                }
            }
            if (!valid) {
                t_x = target.x;
                t_y = target.y;
            }

            switch (this.type) {
                case 'fast':
                    break;
                case 'rocket':
                    this.barrelYaw = Math.atan2(t_x - this.x, t_y - this.y) * -1 + Math.PI / 2;
                    if (this.barrelHeat >= 0) {
                        valid = true;
                        for (let line of map) {
                            if (getLineIntersection({ x1: this.x, y1: this.y, x2: t_x, y2: t_y }, line)) {
                                valid = false;
                                break;
                            }
                        }
                        this.barrelTarget = Math.atan2(t_x - this.x, t_y - this.y) * -1 + Math.PI / 2;
                        if (valid && eqWMargin(this.barrelTarget, this.barrelYaw, Math.PI / 8) && this.barrelHeat < 40) this.fire();
                    }

                    break;
                case 'bounce':
                case 'common':
                    if (this.barrelHeat >= 0) {
                        valid = true;
                        for (let line of map) {
                            if (getLineIntersection({ x1: this.x, y1: this.y, x2: t_x, y2: t_y }, line)) {
                                valid = false;
                                break;
                            }
                        }
                        this.barrelTarget = Math.atan2(t_x - this.x, t_y - this.y) * -1 + Math.PI / 2;
                        if (valid && eqWMargin(this.barrelTarget, this.barrelYaw, Math.PI / 8) && this.barrelHeat < 40) this.fire();
                    }

                    this.moveStates = { front: false, back: false, clockwise: false, counterclockwise: false };
                    if (this.step >= this.step_max) {
                        let valid = false, d_x, d_y;
                        while (!valid) {
                            d_x = Math.floor(Math.random() * 400) - 200;
                            while (this.x + d_x < this.size * 1.2 || this.x + d_x > canvas.width - this.size * 1.2) d_x = Math.floor(Math.random() * 400) - 200;
                            d_y = Math.floor(Math.random() * 400) - 200;
                            while (this.y + d_y < this.size * 1.2 || this.y + d_y > canvas.height - this.size * 1.2) d_y = Math.floor(Math.random() * 400) - 200;
                            valid = true;
                            for (let line of map) {
                                if (getLineIntersection({ x1: this.x, y1: this.y, x2: this.x + d_x, y2: this.y + d_y }, line)) valid = false;
                            }
                        }

                        this.s_yaw = Math.atan2(d_y, d_x);
                        this.s_x = this.speed * Math.cos(this.s_yaw);
                        this.s_y = this.speed * Math.sin(this.s_yaw);

                        this.step_max = Math.floor((d_x / this.s_x + d_y / this.s_y) / 2);
                        this.step = 0;
                    } else {
                        let prev_s_yaw = this.s_yaw;
                        if (this.incomingProjectile) {
                            let incoming = entities.get(this.incomingProjectile);
                            if (incoming) {
                                let atan = Math.atan2(this.y - incoming.y, this.x - incoming.x);
                                this.s_yaw = atan + Math.PI / 2;
                                this.step = 0;
                                this.step_max = 60;
                            } else {
                                this.incomingProjectile = null;
                                this.s_yaw = Math.atan2(this.s_y, this.s_x);
                            }
                        }
                        if (this.incomingProjectile) {
                            this.moveStates.back = true;
                            this.step++;
                        } else {
                            this.step++;
                            this.moveStates.front = true;
                        }
                        if (!eqWMargin(this.bodyYaw, this.s_yaw, this.bodySpeed)) {
                            if (this.bodyYaw < this.s_yaw) {
                                this.moveStates.clockwise = true;
                            } else if (this.bodyYaw > this.s_yaw) {
                                this.moveStates.counterclockwise = true;
                            }
                        }
                        this.s_yaw = prev_s_yaw;
                    }
                    break;
            }
            if (this.barrelYaw !== null) {
                if (this.barrelYaw < this.barrelTarget) {
                    this.barrelYaw += this.barrelSpeed;
                    if (this.barrelYaw > this.barrelTarget) {
                        this.barrelYaw = this.barrelTarget;
                        this.barrelTarget = null;
                    }
                } else if (this.barrelYaw > this.barrelTarget) {
                    this.barrelYaw -= this.barrelSpeed;
                    if (this.barrelYaw < this.barrelTarget) {
                        this.barrelYaw = this.barrelTarget;
                        this.barrelTarget = null;
                    }
                }
            }
        } else {
            // no target? idle anim?
            this.barrelYaw += this.barrelSpeed;
            if (this.barrelYaw > Math.PI * 2 || this.barrelYaw < Math.PI * -2) this.barrelSpeed *= -1;
            this.moveStates = { front: false, back: false, clockwise: false, counterclockwise: false };
        }
    }

    update() {
        if (this.type === 'dead') return;
        let prevX = this.x, prevY = this.y;
        if (this.type === 'player') {
            this.barrelYaw = Math.atan2(mouseX - this.x, mouseY - this.y) * -1 + Math.PI / 2;
            this.moveStates = { front: keysMap.get(this.keyBinds.front), back: keysMap.get(this.keyBinds.back), clockwise: keysMap.get(this.keyBinds.clockwise), counterclockwise: keysMap.get(this.keyBinds.counterclockwise) };

            if (keysMap.get(' ') && !this.didMine) {
                new Projectile(this, 'mine');
                this.didMine = true;
            } else if (!keysMap.get(' ')) this.didMine = false;
        } else {
            // oh fuck i have to implement AI
            this.tankAI();
        }

        if (this.moveStates.counterclockwise) this.bodyYaw -= this.bodySpeed;
        if (this.moveStates.clockwise) this.bodyYaw += this.bodySpeed;
        if (this.moveStates.front) {
            this.x += this.speed * Math.cos(this.bodyYaw);
            this.y += this.speed * Math.sin(this.bodyYaw);

        }
        if (this.moveStates.back) {
            this.x -= this.speed * Math.cos(this.bodyYaw);
            this.y -= this.speed * Math.sin(this.bodyYaw);
        }

        for (let line of map) {
            let collision = this.collide(line);
            if (collision) {
                let AB = { x: line.x2 - line.x1, y: line.y2 - line.y1 },
                    k = ((this.x - line.x1) * AB.x + (this.y - line.y1) * AB.y) / (AB.x * AB.x + AB.y * AB.y),
                    point = { x: line.x1 + k * AB.x, y: line.y1 + k * AB.y },
                    atan = Math.atan2(point.y - this.y, point.x - this.x) + Math.PI;
                // let atan = Math.atan2(collision.y - this.y, collision.x - this.x) + Math.PI;
                this.x += this.speed * Math.cos(atan);
                this.y += this.speed * Math.sin(atan);

                // smooth but less effective collision;
                // this.x = prevX;
                // this.y = prevY;
            }
        }
        let last = this.tracks[this.tracks.length - 1];
        if ((!last || last.x !== this.x || last.y !== this.y) && this.lasttrack + 20 < performance.now()) {
            this.tracks.push({ x: this.x, y: this.y, angle: this.bodyYaw });
            this.lasttrack = performance.now();
            decalRenderQueued = true;
        }

        if (this.barrelHeat >= 100) this.barrelHeat *= -1;
        if (this.barrelHeat > 0) this.barrelHeat--;
        else if (this.barrelHeat < 0) this.barrelHeat++;
    }

    fire() {
        if (this.type === 'dead' || this.barrelHeat < 0) return;
        if (this.type === 'rocket') new Projectile(this, 'rocket');
        else new Projectile(this, 'bullet');
        if (this.type === 'player') this.barrelHeat += 20;
        else if (this.type === 'common') this.barrelHeat += 40;
        else this.barrelHeat += 50;

    }

    destruct() {
        if (this.type === 'dead') return;
        this.type = 'dead';
        this.animState = { anim: 'explode', prog: 0 };
    }

    destroy() {
        entities.delete(this.id);
    }
}

document.getElementById('mapdatainput').addEventListener('change', e => {
    console.log('got input: ' + e.target.value);
    let parsed;
    try {
        parsed = JSON.parse(e.target.value);
    } catch {
        console.log('invalid');
    }
    if (!parsed) return;
    e.target.value = '';
    initLevel(parsed);
});

let map = [], mapSq = [], player = null;
const initLevel = (data) => { // {map: [{x: num, y: num, w: num, h: num}], enemies:[{x: num, y: num, type: str}], player: {x: num, y: num, flags: {}}}
    const loadWarnings = [];
    if (data.map?.length) data.map = data.map.filter(v =>
        (typeof v.x !== 'undefined' && typeof v.y !== 'undefined' && typeof v.w !== 'undefined' && typeof v.h !== 'undefined') ||
        (typeof v.x1 !== 'undefined' && typeof v.y1 !== 'undefined' && typeof v.x2 !== 'undefined' && typeof v.y2 !== 'undefined'));
    for (const elem of data.map) {
        if (elem.x1) {
            map.push(elem);
        } else if (elem.x) {
            map.push({ x1: elem.x, y1: elem.y, x2: elem.x, y2: elem.y + elem.h }); // left
            map.push({ x1: elem.x, y1: elem.y, x2: elem.x + elem.w, y2: elem.y }); // top
            map.push({ x1: elem.x + elem.w, y1: elem.y, x2: elem.x + elem.w, y2: elem.y + elem.h }); // right
            map.push({ x1: elem.x, y1: elem.y + elem.h, x2: elem.x + elem.w, y2: elem.y + elem.h }); // bottom
            if (!elem.hollow) mapSq.push(elem);
        }
    }

    if (!map.length) loadWarnings.push('No valid lines on map');
    mapRenderQueued = true;
    bgctx.fillStyle = '#aaaaff';
    bgctx.fillRect(0, 0, canvas.width, canvas.height);

    entities.clear();
    if (data.enemies?.length) for (let enemy of data.enemies) new Tank(enemy.x, enemy.y, enemy.type);
    if (!entities.size) loadWarnings.push('No enemies on map');

    if (data.player) player = new Tank(data.player.x, data.player.y, 'player', typeof data.player.flags !== 'undefined' ? data.player.flags : null);
    else loadWarnings.push('No player');

    if (loadWarnings.length) alert('Warnings:\n' + loadWarnings.join('\n'));
    console.log('loaded; warnings:\n' + loadWarnings.join('\n'));
}

const circle = (x, y, r, context = ctx) => {
    context.beginPath();
    context.ellipse(Math.floor(x), Math.floor(y), r, r, 0, 0, Math.PI * 2);
    context.closePath();
    context.fill();
}

const renderMapDecals = () => {
    entities.forEach(e => {
        if (e instanceof Projectile && e.detonated) {
            bgctx.fillStyle = '#44444450';
            circle(e.x, e.y, 11, bgctx);
            circle(e.x, e.y, 16, bgctx);
            e.destroy();
        } else if (e instanceof Tank) {
            for (let record of e.tracks) {
                bgctx.fillStyle = '#9a9a9aa0';
                bgctx.save();
                bgctx.translate(record.x, record.y);
                bgctx.rotate(record.angle);
                bgctx.fillRect(e.size * -0.05, e.size * -0.45, e.size * 0.05, e.size * 0.3);
                bgctx.fillRect(e.size * -0.05, e.size * 0.15, e.size * 0.05, e.size * 0.3);
                bgctx.restore();
            }
            e.tracks = [];
        }
    });
    mapRenderQueued = true;
}

const renderMap = () => {
    bgctx.strokeStyle = '#1877f2';
    bgctx.lineWidth = 3;
    bgctx.beginPath();
    bgctx.moveTo(bgcanvas.width * 0.498, bgcanvas.height * 0.01);
    bgctx.lineTo(bgcanvas.width * 0.5, bgcanvas.height * 0.015);
    bgctx.lineTo(bgcanvas.width * 0.502, bgcanvas.height * 0.01);
    bgctx.closePath();
    bgctx.stroke();

    if (!map.length) return;
    bgctx.strokeStyle = '#000000';
    bgctx.beginPath();
    for (let line of map) {
        bgctx.moveTo(line.x1, line.y1);
        bgctx.lineTo(line.x2, line.y2);
    }
    bgctx.closePath();
    bgctx.stroke();
    bgctx.fillStyle = '#000000';
    for (let square of mapSq) {
        bgctx.fillRect(square.x, square.y, square.w, square.h);
    }
}

const renderCursor = (x, y) => {
    ctx.fillStyle = '#ff333366';
    circle(x, y, 7);
    ctx.fillRect(x - 12, y - 3, 24, 6);
    ctx.fillRect(x - 3, y - 12, 6, 24);
}

let lastsim = 0, lastframe = 0, looping = true, mapRenderQueued, decalRenderQueued; // performance.now() starts counting from 0
(function loop() {
    if (looping) {
        if (simrate <= 0 || lastsim + 1000 / simrate <= performance.now()) {
            entities.forEach(v => v.update());
            lastsim = performance.now();
        }
        if (framerate <= 0 || lastframe + 1000 / framerate <= performance.now()) {
            if (mapRenderQueued) { renderMap(); mapRenderQueued = false; }
            if (decalRenderQueued) { renderMapDecals(); decalRenderQueued = false; }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            entities.forEach(v => { if (v instanceof Projectile) v.render() });
            entities.forEach(v => { if (v instanceof Tank) v.render() });
            renderCursor(mouseX, mouseY);
            lastframe = performance.now();
        }
    }
    requestAnimationFrame(loop);
})();

initLevel({
    player: { x: canvas.width * 0.5, y: canvas.height * 0.5, flags: { keyBinds: { front: 'w', back: 's', clockwise: 'd', counterclockwise: 'a' } } },
    map: [{ x: canvas.width * 0.25, y: canvas.height * 0.2, w: canvas.width * 0.05, h: canvas.height * 0.6 }, { x: canvas.width * 0.7, y: canvas.height * 0.2, w: canvas.width * 0.05, h: canvas.height * 0.6 }, { x1: canvas.width * 0.4, y1: canvas.height * 0.35, x2: canvas.width * 0.6, y2: canvas.height * 0.35 }, { x1: canvas.width * 0.4, y1: canvas.height * 0.65, x2: canvas.width * 0.6, y2: canvas.height * 0.65 }, { x: 1, y: 1, w: canvas.width - 2, h: canvas.height - 2, hollow: true }],
    enemies: [{ x: canvas.width * 0.15, y: canvas.height * 0.4, type: 'common' }, { x: canvas.width * 0.15, y: canvas.height * 0.6, type: 'common' }, { x: canvas.width * 0.85, y: canvas.height * 0.6, type: 'common' }, { x: canvas.width * 0.85, y: canvas.height * 0.4, type: 'common' }, { x: canvas.width * 0.5, y: canvas.height * 0.2, type: 'bounce' }, { x: canvas.width * 0.5, y: canvas.height * 0.8, type: 'rocket' }]
})

// { player: { x: canvas.width * 0.5, y: canvas.height * 0.5, flags: { keyBinds: { front: 'w', back: 's', clockwise: 'd', counterclockwise: 'a' } } }, map: [{ x: canvas.width * 0.25, y: canvas.height * 0.2, w: canvas.width * 0.05, h: canvas.height * 0.6 }, { x: canvas.width * 0.7, y: canvas.height * 0.2, w: canvas.width * 0.05, h: canvas.height * 0.6 }, { x1: canvas.width * 0.4, y1: canvas.height * 0.35, x2: canvas.width * 0.6, y2: canvas.height * 0.35 }, { x1: canvas.width * 0.4, y1: canvas.height * 0.65, x2: canvas.width * 0.6, y2: canvas.height * 0.65 }, { x: 1, y: 1, w: canvas.width - 2, h: canvas.height - 2, hollow: true }], enemies: [{ x: canvas.width * 0.15, y: canvas.height * 0.4, type: 'common' }, { x: canvas.width * 0.15, y: canvas.height * 0.6, type: 'common' }, { x: canvas.width * 0.85, y: canvas.height * 0.6, type: 'common' }, { x: canvas.width * 0.85, y: canvas.height * 0.4, type: 'common' }, { x: canvas.width * 0.5, y: canvas.height * 0.2, type: 'bounce' }, { x: canvas.width * 0.5, y: canvas.height * 0.8, type: 'bounce' }] }