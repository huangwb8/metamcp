# 基本

- 更新版本

```
version=1.0.3
创建tag v{version}； 使用 git-commit skill 生成中文commit信息； 使用 git-publish-release skill 发布新版本，release note用中文。
然后，重新build本机的huangwb8/metamcp image至最新版。
```

- 使用 [$awesome-code](/Users/bensz/.codex/skills/awesome-code/SKILL.md) 辅助规划、优化。所有问题都要解决。 如果工作时有疑问，或者有更好的方案，自己选个最优方案优化，不要问我。不要破坏其它功能。要保证最终成品能正常、稳定、高效地工作。 
- 根据 docs/plans/SDK-沙箱机制-v202602231445.md， 使用 [$awesome-code](/Users/bensz/.codex/skills/awesome-code/SKILL.md) 优化代码，所有问题都要解决，所有意见都要落实。 如果工作时有疑问，或者有更好的方案，自己选个最优方案优化，不要问我。 不要破坏其它功能。 要保证最终成品能正常、稳定、高效地工作。 

# 日常

---

优化metamcp的实时日志界面：

- 可以对error/warning等进行分类，具体哪些分类你按行业常规定
- 每条日志默认是收起模式，用户点击展开的时候才能看到细节
- 允许把当前的日志以json的形式复制（如果用户点击了error类别，那就只copy error类别的日志）
- 目前日志展示在一个大黑框里。 我觉得不需要这个大黑框。 直接每条罗列出来就行。要求排版紧凑、优美。

使用 [$awesome-code](/Users/bensz/.codex/skills/awesome-code/SKILL.md) 辅助规划、优化。所有问题都要解决。 如果工作时有疑问，或者有更好的方案，自己选个最优方案优化，不要问我。不要破坏其它功能。要保证最终成品能正常、稳定、高效地工作。 

---

目前，metamcp的日志里，看不到mcp工作的具体过程（比如什么时候哪些mcp被激活了，这些mcp干了啥之类的）。我希望能看到，这样我就可以判断mcp是否真的被实际地调用了。  使用 [$awesome-code](/Users/bensz/.codex/skills/awesome-code/SKILL.md) 辅助规划、优化。所有问题都要解决。 如果工作时有疑问，或者有更好的方案，自己选个最优方案优化，不要问我。不要破坏其它功能。要保证最终成品能正常、稳定、高效地工作。 

---

请模仿 /Volumes/2T01/winE/Starup/bensz-channel , 搞个自动化生成 docker image并推到 docker hub 官方的流程。  使用 [$awesome-code](/Users/bensz/.codex/skills/awesome-code/SKILL.md) 辅助规划、优化。所有问题都要解决。 如果工作时有疑问，或者有更好的方案，自己选个最优方案优化，不要问我。不要破坏其它功能。要保证最终成品能正常、稳定、高效地工作。 

---

./tests里还没有真正的测试代码；请你根据本项目的实验情况写测试用代码。 使用 [$awesome-code](/Users/bensz/.codex/skills/awesome-code/SKILL.md) 辅助规划、优化。所有问题都要解决。 如果工作时有疑问，或者有更好的方案，自己选个最优方案优化，不要问我。不要破坏其它功能。要保证最终成品能正常、稳定、高效地工作。 

---

新增 ./tests 目录，里面存放各种metamcp测试相关的代码。 让ai可以基于这些代码，判断自己更改后的项目是否可以正常运行。

新增 ./tmp 目录，里面存放各种测试相关的中间文件（随时删除也不影响程序正常运行）。

相关的规则也要写入 @AGENTS.md 里

---

/Volumes/2T01/winE/Starup/dudu/docs/plans/2026-03-21-metamcp-已知bug总结.md 里有很多已知的metamcp的bug。 你修复一下。