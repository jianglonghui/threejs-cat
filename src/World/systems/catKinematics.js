import { Euler, Quaternion, Vector3, MathUtils } from 'three';

/**
 * 猫咪运动学控制器
 * 控制骨骼实现真实的猫咪运动
 */
class CatKinematics {
  constructor(model) {
    this.model = model;
    this.bones = {};
    this.initialized = false;

    // 运动状态
    this.currentVelocity = new Vector3();
    this.targetDirection = new Vector3(0, 0, -1); // 默认朝向
    this.currentDirection = new Vector3(0, 0, -1);

    // 脊椎弯曲参数
    this.spineRotation = 0;
    this.targetSpineRotation = 0;

    // 尾巴物理参数
    this.tailSegments = [];
    this.tailPhysics = {
      stiffness: 8,
      damping: 0.7,
      velocities: [0, 0, 0, 0, 0]
    };

    // 头部参数
    this.headRotation = new Euler();
    this.targetHeadRotation = new Euler();

    // 初始化骨骼引用
    this._initBones();
  }

  _initBones() {
    const findBone = (name) => {
      let found = null;
      this.model.traverse((obj) => {
        if (obj.isBone && obj.name.includes(name)) {
          found = obj;
        }
      });
      return found;
    };

    // 获取关键骨骼
    this.bones = {
      root: findBone('root_01'),
      torso: findBone('torso_02'),
      spine01: findBone('spine.01'),
      spine02: findBone('spine.02'),
      neck: findBone('neck'),
      head: findBone('head_018'),
      // 尾巴
      tail: findBone('tail_07'),
      tail01: findBone('tail.01'),
      tail02: findBone('tail.02'),
      tail03: findBone('tail.03'),
      tailEnd: findBone('tail.end'),
      // 前腿
      legFL: findBone('leg.upper.F.L'),
      legFR: findBone('leg.upper.F.R'),
      // 后腿
      legBL: findBone('thigh.B.L'),
      legBR: findBone('thigh.B.R'),
    };

    // 保存初始旋转
    this.initialRotations = {};
    for (const [name, bone] of Object.entries(this.bones)) {
      if (bone) {
        this.initialRotations[name] = bone.rotation.clone();
      }
    }

    // 尾巴段落
    this.tailSegments = [
      this.bones.tail,
      this.bones.tail01,
      this.bones.tail02,
      this.bones.tail03,
      this.bones.tailEnd
    ].filter(Boolean);

    this.initialized = Object.values(this.bones).some(b => b !== null);

    if (this.initialized) {
      console.log('猫咪运动学初始化成功，找到骨骼:', Object.keys(this.bones).filter(k => this.bones[k]));
    }
  }

  /**
   * 更新运动学
   * @param {number} delta - 帧时间
   * @param {Vector3} velocity - 当前速度
   * @param {boolean} isOnGround - 是否在地面
   */
  update(delta, velocity, isOnGround) {
    if (!this.initialized) return;

    this.currentVelocity.copy(velocity);
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    const isMoving = speed > 10;

    // 1. 计算目标朝向
    if (isMoving) {
      this.targetDirection.set(velocity.x, 0, velocity.z).normalize();
    }

    // 2. 平滑插值当前朝向
    this.currentDirection.lerp(this.targetDirection, delta * 5);

    // 3. 更新身体朝向
    this._updateBodyRotation(delta);

    // 4. 更新脊椎弯曲
    this._updateSpineBend(delta, velocity);

    // 5. 更新头部
    this._updateHead(delta, isMoving);

    // 6. 更新尾巴物理
    this._updateTail(delta, velocity, isMoving);
  }

  /**
   * 更新身体朝向 - 让猫面向移动方向
   */
  _updateBodyRotation(delta) {
    if (!this.bones.root) return;

    const targetAngle = Math.atan2(this.currentDirection.x, this.currentDirection.z);

    // 平滑旋转
    const currentY = this.bones.root.rotation.y;
    let diff = targetAngle - currentY;

    // 处理角度环绕
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    this.bones.root.rotation.y += diff * delta * 8;
  }

  /**
   * 更新脊椎弯曲 - 转弯时产生 S 形弯曲
   */
  _updateSpineBend(delta, velocity) {
    if (!this.bones.spine01 || !this.bones.spine02 || !this.bones.torso) return;

    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

    // 计算转向角速度
    const currentAngle = Math.atan2(this.currentDirection.x, this.currentDirection.z);
    const targetAngle = Math.atan2(this.targetDirection.x, this.targetDirection.z);
    let turnRate = targetAngle - currentAngle;
    while (turnRate > Math.PI) turnRate -= Math.PI * 2;
    while (turnRate < -Math.PI) turnRate += Math.PI * 2;

    // 根据转向和速度计算脊椎弯曲量
    const bendAmount = MathUtils.clamp(turnRate * (speed / 300) * 0.5, -0.4, 0.4);

    this.targetSpineRotation = bendAmount;
    this.spineRotation = MathUtils.lerp(this.spineRotation, this.targetSpineRotation, delta * 6);

    // 应用到脊椎骨骼 - S 形弯曲
    const initial01 = this.initialRotations.spine01;
    const initial02 = this.initialRotations.spine02;
    const initialTorso = this.initialRotations.torso;

    if (initial01) {
      this.bones.spine01.rotation.y = initial01.y + this.spineRotation * 0.5;
    }
    if (initial02) {
      this.bones.spine02.rotation.y = initial02.y - this.spineRotation * 0.3;
    }
    if (initialTorso) {
      this.bones.torso.rotation.y = initialTorso.y + this.spineRotation * 0.4;
    }
  }

  /**
   * 更新头部 - 独立看向移动方向
   */
  _updateHead(delta, isMoving) {
    if (!this.bones.head || !this.bones.neck) return;

    const initialHead = this.initialRotations.head;
    const initialNeck = this.initialRotations.neck;

    if (isMoving) {
      // 头部稍微看向移动方向
      const headTurn = Math.atan2(this.targetDirection.x, this.targetDirection.z) -
        Math.atan2(this.currentDirection.x, this.currentDirection.z);

      this.targetHeadRotation.y = MathUtils.clamp(headTurn * 0.3, -0.3, 0.3);
    } else {
      // 静止时头部回正
      this.targetHeadRotation.y = 0;
    }

    // 平滑插值
    this.headRotation.y = MathUtils.lerp(this.headRotation.y, this.targetHeadRotation.y, delta * 4);

    if (initialHead) {
      this.bones.head.rotation.y = initialHead.y + this.headRotation.y;
    }
    if (initialNeck) {
      this.bones.neck.rotation.y = initialNeck.y + this.headRotation.y * 0.5;
    }
  }

  /**
   * 更新尾巴物理 - 弹簧物理模拟
   */
  _updateTail(delta, velocity, isMoving) {
    if (this.tailSegments.length === 0) return;

    const { stiffness, damping, velocities } = this.tailPhysics;

    // 计算尾巴的目标方向（与移动方向相反，用于平衡）
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    const swingIntensity = isMoving ? MathUtils.clamp(speed / 500, 0.1, 0.8) : 0.05;

    // 添加一些自然摆动
    const time = performance.now() * 0.003;
    const naturalSwing = Math.sin(time * 2) * 0.1;

    // 转弯时尾巴向相反方向摆动
    const turnSwing = -this.spineRotation * 1.5;

    // 更新每段尾巴
    for (let i = 0; i < this.tailSegments.length; i++) {
      const bone = this.tailSegments[i];
      if (!bone) continue;

      const initialKey = ['tail', 'tail01', 'tail02', 'tail03', 'tailEnd'][i];
      const initial = this.initialRotations[initialKey];
      if (!initial) continue;

      // 弹簧物理
      const targetRotation = (turnSwing + naturalSwing * swingIntensity) * (1 + i * 0.3);
      const currentRotation = bone.rotation.y - initial.y;
      const force = (targetRotation - currentRotation) * stiffness;

      velocities[i] += force * delta;
      velocities[i] *= damping;

      bone.rotation.y = initial.y + currentRotation + velocities[i] * delta;

      // 限制旋转范围
      const maxRotation = 0.5 + i * 0.1;
      bone.rotation.y = MathUtils.clamp(
        bone.rotation.y,
        initial.y - maxRotation,
        initial.y + maxRotation
      );
    }
  }
}

function createCatKinematics(model) {
  return new CatKinematics(model);
}

export { createCatKinematics, CatKinematics };
