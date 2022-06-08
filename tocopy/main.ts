// title:  game title
// author: game developer
// desc:   short description
// script: js

let x = 0
let y = 0
let c = 8

function _init() { }

function _update() {
  if (btn(0) && x > 0) x--
  if (btn(1) && x < 127) x++
  if (btn(2) && y > 0) y--
  if (btn(3) && y < 127) y++
  if (btn(4) && c > 1) c--
  if (btn(5) && c < 15) c++
}

function _draw() {
  cls()
  circfill(x, y, 10, c)
}

// do not delete these lines (for the build process)
_init()
_update()
_draw()