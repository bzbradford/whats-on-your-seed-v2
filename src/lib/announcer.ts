// Screen-reader announcements through two always-mounted live regions
// (legacy `announce`): polite messages are debounced by 250 ms; urgent ones go
// to the alert region at once and cancel a pending polite message.

export interface LiveRegions {
  status: string;
  alert: string;
}

export class Announcer {
  #timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private regions: LiveRegions,
    private delay = 250,
  ) {}

  announce(message: string, urgent = false): void {
    clearTimeout(this.#timer);
    if (urgent) {
      this.regions.status = '';
      if (this.regions.alert !== message) this.regions.alert = message;
      return;
    }
    this.#timer = setTimeout(() => {
      if (this.regions.status !== message) this.regions.status = message;
    }, this.delay);
  }

  clearAlert(): void {
    this.regions.alert = '';
  }
}
