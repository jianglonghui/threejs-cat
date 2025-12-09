// 极简键盘输入控制
class InputControls {
  constructor() {
    this.keys = {
      forward: false,   // W / ArrowUp
      backward: false,  // S / ArrowDown
      left: false,      // A / ArrowLeft
      right: false,     // D / ArrowRight
      jump: false,      // Space
    };

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _onKeyDown(event) {
    this._updateKey(event.code, true);
  }

  _onKeyUp(event) {
    this._updateKey(event.code, false);
  }

  _updateKey(code, pressed) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = pressed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = pressed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = pressed;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = pressed;
        break;
      case 'Space':
        this.keys.jump = pressed;
        break;
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}

function createInputControls() {
  return new InputControls();
}

export { createInputControls };
