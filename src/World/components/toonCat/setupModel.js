import { AnimationMixer } from "three";

function setupModel(data) {
  console.log("setupModel");
  const model = data.scene.children[0];

  const clip = data.animations[0];

  const mixer = new AnimationMixer(model);
  const action = mixer.clipAction(clip);

  // 不自动播放，由运动学控制器控制
  action.play();
  action.paused = true;

  model.mixer = mixer;
  model.action = action; // 保存 action 引用

  return model;
}

export { setupModel };
