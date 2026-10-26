/**
 * Tool request handlers for email operations
 */

import { getAccount, loadAccounts } from './accountManager.js';
import { searchEmails, modifyEmails, listFolders, createFolder, deleteFolder } from './imapService.js';
import { sendEmail, replyToEmail, forwardEmail, createDraft } from './smtpService.js';
import { EmailAccount, EmailFilters } from './types.js';

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} is required`);
  }
  return value;
}

function requireStringArray(value: unknown, fieldName: string, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`${fieldName} is required and must be ${allowEmpty ? 'an array of strings' : 'a non-empty array of strings'}`);
  }
  return value;
}

function validateOptionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) return undefined;
  return requireStringArray(value, fieldName, true);
}

function validateOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${fieldName} must be a non-empty string`);
  return value;
}

function validateOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${fieldName} must be a boolean`);
  return value;
}

function validateBodyType(value: unknown): 'plain' | 'html' {
  if (value === undefined) return 'html';
  if (value !== 'plain' && value !== 'html') throw new Error('body_type must be plain or html');
  return value;
}

function validateAttachments(value: unknown, fieldName: string): any[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${fieldName} must be an array`);
  for (const attachment of value) {
    if (!attachment || typeof attachment !== 'object' || typeof attachment.filename !== 'string' || typeof attachment.content !== 'string') {
      throw new Error(`${fieldName} entries require string filename and base64 content fields`);
    }
  }
  return value;
}

/**
 * Refuse state-changing operations on read-only accounts
 */
export function assertWritable(config: EmailAccount, action: string): void {
  if (config.read_only) throw new Error(`Account is read-only: ${action} is disabled (READ_ONLY)`);
}

export function assertDeleteAllowed(config: EmailAccount, permanent: boolean, action: string): void {
  assertWritable(config, action);
  if (permanent) {
    if (!config.allow_permanent_delete) {
      throw new Error(`Permanent deletion is disabled for this account: ${action} requires ALLOW_PERMANENT_DELETE=true`);
    }
  } else if (config.allow_delete === false) {
    throw new Error(`Deleting is disabled for this account: ${action} requires ALLOW_DELETE=true`);
  }
}

export async function handleAccountsList(): Promise<string> {
  try {
    const accounts = loadAccounts();
    const accountNames = Object.keys(accounts);
    const defaultAccount = process.env.DEFAULT_EMAIL_ACCOUNT || accountNames[0];

    return JSON.stringify({
      success: true,
      count: accountNames.length,
      default_account: defaultAccount,
      accounts: accountNames.map((name) => ({
        name,
        is_default: name === defaultAccount,
        smtp_configured: Boolean(accounts[name].smtp_host),
        imap_configured: Boolean(accounts[name].imap_host),
        sender_count: accounts[name].sender_emails?.length || 1,
        read_only: Boolean(accounts[name].read_only),
        allow_delete: accounts[name].allow_delete !== false,
        allow_permanent_delete: Boolean(accounts[name].allow_permanent_delete)
      }))
    }, null, 2);
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error.message || 'Failed to list accounts'
    }, null, 2);
  }
}

/**
 * Handle emails_find tool
 */
export async function handleEmailsFind(args: any): Promise<string> {
  try {
    args = args || {};
    const { name, config } = getAccount(args.account_name);

    if (args.query !== undefined && typeof args.query !== 'string') throw new Error('query must be a string');
    if (args.filters !== undefined && (!args.filters || typeof args.filters !== 'object' || Array.isArray(args.filters))) {
      throw new Error('filters must be an object');
    }
    const filters: EmailFilters = args.filters || {};
    for (const stringField of ['from', 'to', 'subject'] as const) {
      validateOptionalString(filters[stringField], `filters.${stringField}`);
    }
    for (const booleanField of ['has_attachments', 'is_unread', 'is_flagged'] as const) {
      validateOptionalBoolean(filters[booleanField], `filters.${booleanField}`);
    }
    for (const dateField of ['after_date', 'before_date'] as const) {
      if (filters[dateField] !== undefined && (typeof filters[dateField] !== 'string' || Number.isNaN(Date.parse(filters[dateField]!)))) {
        throw new Error(`filters.${dateField} must be a valid date`);
      }
    }
    const limit = args.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('limit must be an integer between 1 and 100');
    if (args.include_content !== undefined && typeof args.include_content !== 'boolean') throw new Error('include_content must be a boolean');
    if (args.include_attachments !== undefined && typeof args.include_attachments !== 'boolean') throw new Error('include_attachments must be a boolean');
    const includeContent = args.include_content ?? false;
    const includeAttachments = args.include_attachments ?? false;

    const emails = await searchEmails(
      config,
      filters,
      limit,
      includeContent,
      includeAttachments,
      args.query,
      validateOptionalString(args.folder, 'folder')
    );

    return JSON.stringify({
      success: true,
      account: name,
      total_found: emails.length,
      count: emails.length,
      emails
    }, null, 2);

  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error.message || 'Failed to search emails'
    }, null, 2);
  }
}

/**
 * Handle emails_modify tool
 */
export async function handleEmailsModify(args: any): Promise<string> {
  try {
    args = args || {};
    const { name, config } = getAccount(args.account_name);

    const emailIds = requireStringArray(args.email_ids, 'email_ids');
    if (emailIds.some((id) => !/^\d+$/.test(id) || Number(id) < 1)) {
      throw new Error('email_ids entries must be positive numeric UIDs');
    }
    for (const booleanField of ['mark_read', 'mark_unread', 'flag', 'unflag']) {
      validateOptionalBoolean(args[booleanField], booleanField);
    }
    validateOptionalString(args.move_to_folder, 'move_to_folder');
    const folder = validateOptionalString(args.folder, 'folder');
    validateOptionalBoolean(args.delete, 'delete');
    validateOptionalBoolean(args.permanent, 'permanent');
    if (args.permanent && !args.delete) throw new Error('permanent requires delete to be true');
    assertWritable(config, 'emails_modify');
    if (args.delete) assertDeleteAllowed(config, Boolean(args.permanent), 'emails_modify delete');
    if (args.delete && args.move_to_folder) throw new Error('delete and move_to_folder cannot be combined');
    if (!args.mark_read && !args.mark_unread && !args.flag && !args.unflag && !args.move_to_folder && !args.delete) {
      throw new Error('At least one modification is required');
    }
    if (args.mark_read && args.mark_unread) {
      throw new Error('mark_read and mark_unread cannot both be true');
    }
    if (args.flag && args.unflag) {
      throw new Error('flag and unflag cannot both be true');
    }

    const result = await modifyEmails(config, emailIds, {
      markRead: args.mark_read,
      markUnread: args.mark_unread,
      flag: args.flag,
      unflag: args.unflag,
      moveToFolder: args.move_to_folder,
      delete: args.delete,
      permanent: args.permanent,
      folder
    });

    return JSON.stringify({
      success: result.success,
      account: name,
      modified: result.modified,
      total: emailIds.length,
      ...(result.deleted_to ? { deleted_to: result.deleted_to } : {}),
      errors: result.errors
    }, null, 2);

  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error.message || 'Failed to modify emails'
    }, null, 2);
  }
}

/**
 * Handle email_send tool
 */
export async function handleEmailSend(args: any): Promise<string> {
  try {
    args = args || {};
    const { name, config } = getAccount(args.account_name);

    assertWritable(config, 'email_send');
    const to = requireStringArray(args.to, 'to');
    const subject = requireString(args.subject, 'subject');
    const body = requireString(args.body, 'body');
    const cc = validateOptionalStringArray(args.cc, 'cc');
    const bcc = validateOptionalStringArray(args.bcc, 'bcc');
    const attachments = validateAttachments(args.attachments, 'attachments');
    const fromEmail = validateOptionalString(args.from_email, 'from_email');

    const result = await sendEmail(config, {
      to,
      subject,
      body,
      bodyType: validateBodyType(args.body_type),
      cc,
      bcc,
      attachments,
      fromName: config.default_from_name,
      fromEmail
    });

    return JSON.stringify({
      success: result.success,
      account: name,
      message_id: result.messageId,
      ...(result.sent_copy ? { sent_copy: result.sent_copy } : {}),
      to,
      subject
    }, null, 2);

  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error.message || 'Failed to send email'
    }, null, 2);
  }
}

/**
 * Handle email_respond tool
 */
export async function handleEmailRespond(args: any): Promise<string> {
  try {
    args = args || {};
    const { name, config } = getAccount(args.account_name);

    assertWritable(config, 'email_respond');
    const emailId = requireString(args.email_id, 'email_id');
    const folder = validateOptionalString(args.folder, 'folder');
    const body = requireString(args.body, 'body');
    const to = validateOptionalStringArray(args.to, 'to');
    const additionalAttachments = validateAttachments(args.additional_attachments, 'additional_attachments');
    validateOptionalBoolean(args.include_original, 'include_original');
    validateOptionalBoolean(args.include_attachments, 'include_attachments');

    const responseType = args.response_type || 'reply';
    if (!['reply', 'reply_all', 'forward'].includes(responseType)) {
      throw new Error('response_type must be reply, reply_all, or forward');
    }

    let result;

    if (responseType === 'forward') {
      if (!to?.length) throw new Error('to is required for forward');

      result = await forwardEmail(config, emailId, {
        to,
        body,
        bodyType: validateBodyType(args.body_type),
        includeOriginal: args.include_original !== false,
        includeAttachments: args.include_attachments !== false,
        additionalAttachments,
        folder
      });

    } else {
      result = await replyToEmail(config, emailId, {
        body,
        bodyType: validateBodyType(args.body_type),
        to,
        replyAll: responseType === 'reply_all',
        includeOriginal: args.include_original !== false,
        includeAttachments: args.include_attachments !== false,
        additionalAttachments,
        folder
      });
    }

    return JSON.stringify({
      success: result.success,
      account: name,
      message_id: result.messageId,
      ...(result.sent_copy ? { sent_copy: result.sent_copy } : {}),
      response_type: responseType,
      original_email_id: emailId,
      original_flagged: result.original_flagged ?? false
    }, null, 2);

  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error.message || 'Failed to respond to email'
    }, null, 2);
  }
}

/**
 * Handle folders_list tool
 */
export async function handleFoldersList(args: any): Promise<string> {
  try {
    args = args || {};
    const { name, config } = getAccount(args.account_name);

    if (args.include_counts !== undefined && typeof args.include_counts !== 'boolean') {
      throw new Error('include_counts must be a boolean');
    }

    const folders = await listFolders(
      config,
      args.include_counts ?? false
    );

    return JSON.stringify({
      success: true,
      account: name,
      count: folders.length,
      folders
    }, null, 2);

  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error.message || 'Failed to list folders'
    }, null, 2);
  }
}

/**
 * Handle draft_create tool
 */
export async function handleDraftCreate(args: any): Promise<string> {
  try {
    args = args || {};
    const { name, config } = getAccount(args.account_name);

    assertWritable(config, 'draft_create');
    const subject = requireString(args.subject, 'subject');
    const body = requireString(args.body, 'body');
    const to = validateOptionalStringArray(args.to, 'to');
    const cc = validateOptionalStringArray(args.cc, 'cc');
    const bcc = validateOptionalStringArray(args.bcc, 'bcc');
    const attachments = validateAttachments(args.attachments, 'attachments');

    const result = await createDraft(config, {
      to,
      subject,
      body,
      bodyType: validateBodyType(args.body_type),
      cc,
      bcc,
      attachments,
      fromName: config.default_from_name,
      fromEmail: validateOptionalString(args.from_email, 'from_email'),
      folder: validateOptionalString(args.folder, 'folder')
    });

    return JSON.stringify({
      success: true,
      account: name,
      folder: result.folder,
      ...(result.uid !== undefined ? { email_id: String(result.uid) } : {}),
      subject
    }, null, 2);

  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error.message || 'Failed to create draft'
    }, null, 2);
  }
}

/**
 * Handle folder_create tool
 */
export async function handleFolderCreate(args: any): Promise<string> {
  try {
    args = args || {};
    const { name: accountName, config } = getAccount(args.account_name);
    assertWritable(config, 'folder_create');
    const path = await createFolder(config, requireString(args.name, 'name'));
    return JSON.stringify({ success: true, account: accountName, folder: path }, null, 2);
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error.message || 'Failed to create folder'
    }, null, 2);
  }
}

/**
 * Handle folder_delete tool
 */
export async function handleFolderDelete(args: any): Promise<string> {
  try {
    args = args || {};
    const { name: accountName, config } = getAccount(args.account_name);
    assertDeleteAllowed(config, true, 'folder_delete');
    const path = await deleteFolder(config, requireString(args.name, 'name'));
    return JSON.stringify({ success: true, account: accountName, deleted: path }, null, 2);
  } catch (error: any) {
    return JSON.stringify({
      success: false,
      error: error.message || 'Failed to delete folder'
    }, null, 2);
  }
}
