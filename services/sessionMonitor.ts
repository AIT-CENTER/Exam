// services/sessionMonitor.ts
import { supabase } from "@/lib/supabaseClient";

export class SessionMonitor {
  private static instance: SessionMonitor;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 10000; // 10 seconds

  static getInstance() {
    if (!SessionMonitor.instance) {
      SessionMonitor.instance = new SessionMonitor();
    }
    return SessionMonitor.instance;
  }

  startHeartbeat(sessionId: string, securityToken: string) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        await supabase
          .from('exam_sessions')
          .update({ 
            last_activity_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .eq('security_token', securityToken);

        // Also update session security
        await supabase
          .from('session_security')
          .update({ last_verified: new Date().toISOString() })
          .eq('session_id', sessionId)
          .eq('token', securityToken);
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async validateSession(sessionId: string, securityToken: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('session_security')
        .select('is_active, last_verified')
        .eq('session_id', sessionId)
        .eq('token', securityToken)
        .single();

      if (error || !data) return false;

      // Check if session was verified within last 30 seconds
      const lastVerified = new Date(data.last_verified);
      const now = new Date();
      const diffInSeconds = (now.getTime() - lastVerified.getTime()) / 1000;

      return data.is_active && diffInSeconds < 30;
    } catch {
      return false;
    }
  }
}