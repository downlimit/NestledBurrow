export class UiVisibilityCoordinator {
  constructor() {
    this.members = new Map();
    this.hiddenClasses = new Set();
  }

  register(component, classNames) {
    if (!component?.setSuppressed) throw new Error("UI visibility member must implement setSuppressed");
    const classes = new Set(classNames);
    this.members.set(component, classes);
    this.syncMember(component, classes);
    return () => this.members.delete(component);
  }

  setClassHidden(className, hidden) {
    if (hidden) this.hiddenClasses.add(className);
    else this.hiddenClasses.delete(className);
    this.sync();
  }

  sync() {
    for (const [component, classes] of this.members) this.syncMember(component, classes);
  }

  syncMember(component, classes) {
    component.setSuppressed([...classes].some((className) => this.hiddenClasses.has(className)));
  }

  destroy() {
    this.members.clear();
    this.hiddenClasses.clear();
  }
}
