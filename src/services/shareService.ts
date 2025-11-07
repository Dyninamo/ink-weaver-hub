import { supabase } from "@/integrations/supabase/client";
import { buildShareUrl } from "@/utils/shareTokens";

export interface ShareLink {
  queryId: string;
  shareToken: string;
  shareUrl: string;
}

export interface ShareOptions {
  customMessage?: string;
}

/**
 * Create share links for one or more queries
 */
export async function createShareLinks(
  queryIds: string[]
): Promise<ShareLink[]> {
  try {
    const { data, error } = await supabase.functions.invoke('create-share-link', {
      body: { queryIds }
    });
    
    if (error) throw error;
    
    if (!data || !data.shareLinks) {
      throw new Error('Failed to create share links');
    }
    
    return data.shareLinks;
  } catch (error: any) {
    console.error('Error creating share links:', error);
    throw new Error(error.message || 'Failed to create share links');
  }
}

/**
 * Share reports via email
 */
export async function shareViaEmail(
  shareTokens: string[],
  recipientEmail: string,
  customMessage?: string
): Promise<void> {
  try {
    if (!recipientEmail || !recipientEmail.trim()) {
      throw new Error('Recipient email is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error('Invalid email address');
    }

    const { error } = await supabase.functions.invoke('share-via-email', {
      body: { 
        shareTokens, 
        recipientEmail: recipientEmail.trim(), 
        customMessage 
      }
    });
    
    if (error) throw error;
  } catch (error: any) {
    console.error('Error sharing via email:', error);
    throw new Error(error.message || 'Failed to send email');
  }
}

/**
 * Share reports via SMS
 */
export async function shareViaSMS(
  shareTokens: string[],
  recipientPhone: string,
  customMessage?: string
): Promise<void> {
  try {
    if (!recipientPhone || !recipientPhone.trim()) {
      throw new Error('Recipient phone number is required');
    }

    // Basic phone validation (should start with +)
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(recipientPhone.trim())) {
      throw new Error('Invalid phone number format (use +country code + number)');
    }

    const { error } = await supabase.functions.invoke('share-via-sms', {
      body: { 
        shareTokens, 
        recipientPhone: recipientPhone.trim(), 
        customMessage 
      }
    });
    
    if (error) throw error;
  } catch (error: any) {
    console.error('Error sharing via SMS:', error);
    throw new Error(error.message || 'Failed to send SMS');
  }
}

/**
 * Copy share link(s) to clipboard
 */
export async function copyShareLink(
  queryIds: string[]
): Promise<string> {
  try {
    if (!queryIds || queryIds.length === 0) {
      throw new Error('No queries selected');
    }

    const links = await createShareLinks(queryIds);
    
    if (!links || links.length === 0) {
      throw new Error('No share links created');
    }

    // For single link, return the URL directly
    if (links.length === 1) {
      const url = links[0].shareUrl;
      
      // Check if clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      return url;
    }

    // For multiple links, create a formatted message
    const message = createMultiShareMessage(links);
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(message);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = message;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    
    return message;
  } catch (error: any) {
    console.error('Error copying share link:', error);
    throw new Error(error.message || 'Failed to copy link to clipboard');
  }
}

/**
 * Use native share API if available
 */
export async function nativeShare(
  queryIds: string[]
): Promise<void> {
  try {
    if (!navigator.share) {
      throw new Error('Native share not supported on this device');
    }

    if (!queryIds || queryIds.length === 0) {
      throw new Error('No queries selected');
    }

    const links = await createShareLinks(queryIds);
    
    if (!links || links.length === 0) {
      throw new Error('No share links created');
    }

    // For single link
    if (links.length === 1) {
      await navigator.share({
        title: '🎣 Fishing Advice Report',
        text: 'Check out this fishing advice report!',
        url: links[0].shareUrl
      });
      return;
    }

    // For multiple links
    const message = createMultiShareMessage(links);
    
    await navigator.share({
      title: '🎣 Fishing Advice Reports',
      text: message,
    });
  } catch (error: any) {
    // User cancelled share dialog
    if (error.name === 'AbortError') {
      console.log('Share cancelled by user');
      return;
    }
    
    console.error('Error with native share:', error);
    throw new Error(error.message || 'Failed to share');
  }
}

/**
 * Check if native share is supported
 */
export function isNativeShareSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

/**
 * Create a formatted message for multiple share links
 */
function createMultiShareMessage(links: ShareLink[]): string {
  let message = '🎣 Fishing Advice Reports\n\n';
  
  links.forEach((link, index) => {
    message += `Report ${index + 1}:\n${link.shareUrl}\n\n`;
  });
  
  message += 'Powered by Fishing Intelligence Advisor';
  
  return message;
}

/**
 * Get share statistics for a query
 */
export async function getShareStats(queryId: string): Promise<{
  viewCount: number;
  shares: number;
}> {
  try {
    const { data, error } = await supabase
      .from('shared_reports')
      .select('view_count, id')
      .eq('query_id', queryId);

    if (error) throw error;

    if (!data || data.length === 0) {
      return { viewCount: 0, shares: 0 };
    }

    const totalViews = data.reduce((sum, report) => sum + (report.view_count || 0), 0);
    
    return {
      viewCount: totalViews,
      shares: data.length,
    };
  } catch (error: any) {
    console.error('Error getting share stats:', error);
    return { viewCount: 0, shares: 0 };
  }
}
