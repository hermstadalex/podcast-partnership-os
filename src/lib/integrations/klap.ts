import 'server-only';

const API_URL = "https://api.klap.app/v2";

interface KlapEditingOptions {
  intro_title?: boolean;
}

export class KlapService {
  private get apiKey() {
    const key = process.env.KLAP_API_KEY;
    if (!key) throw new Error("KLAP_API_KEY is not defined");
    return key;
  }

  private async fetchApi(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.apiKey}`);
    
    if (options.body) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });

    if (!res.ok) {
      let errText = await res.text().catch(() => '');
      try {
        const parsed = JSON.parse(errText);
        if (parsed.message) errText = parsed.message;
        if (parsed.error) errText = parsed.error;
      } catch (e) {}
      throw new Error(`Klap API Error (${res.status}): ${errText}`);
    }

    return res.json();
  }

  /**
   * Submit a video to be analyzed and converted into shorts.
   */
  async generateShorts(sourceVideoUrl: string, language: string = "en", maxDuration: number = 60, maxClipCount: number = 5) {
    return this.fetchApi('/tasks/video-to-shorts', {
      method: 'POST',
      body: JSON.stringify({
        source_video_url: sourceVideoUrl,
        language,
        max_duration: maxDuration,
        max_clip_count: maxClipCount,
        editing_options: {
          intro_title: false
        }
      })
    });
  }

  /**
   * Poll a specific task to see if processing is complete.
   */
  async getTaskStatus(taskId: string) {
    return this.fetchApi(`/tasks/${taskId}`, {
      method: 'GET'
    });
  }

  /**
   * Retrieve all generated shorts (projects) for a given output folder ID.
   */
  async getProjects(folderId: string) {
    return this.fetchApi(`/projects/${folderId}`, {
      method: 'GET'
    });
  }

  /**
   * Initiate export for a specific short.
   */
  async exportShort(folderId: string, projectId: string) {
    return this.fetchApi(`/projects/${folderId}/${projectId}/exports`, {
      method: 'POST',
      body: JSON.stringify({
        // Minimal configuration, you can add watermark here if needed later
      })
    });
  }

  /**
   * Poll export status for a specific short.
   */
  async getExportStatus(folderId: string, projectId: string, exportId: string) {
    return this.fetchApi(`/projects/${folderId}/${projectId}/exports/${exportId}`, {
      method: 'GET'
    });
  }
}

export const klapApi = new KlapService();
