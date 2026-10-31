# Email MCP tool reference

The server exposes six tools over the Model Context Protocol (MCP) stdio transport. The following reference describes their input objects, returned JSON and error behavior. All examples are fictional and use reserved `.test` addresses; example message IDs and mailbox UIDs do not identify real messages.

## Calls and results

Invoke a tool with its name and an `arguments` object through an MCP client. The server advertises its input schemas through `tools/list`. Successful tool results contain one text content item whose `text` is a JSON string:

```json
{
  "content": [
    { "type": "text", "text": "{\"success\":true,\"account\":\"work\",\"count\":0,\"folders\":[]}" }
  ]
}
```

Parse `content[0].text` to obtain the tool's response object. Failed operations set the MCP result's `isError` to `true` and return `success: false` in that JSON. Optional response properties are omitted when their value is unavailable, rather than necessarily being returned as `null`.

The five mailbox tools accept an optional `account_name` string. It must name a configured account and be non-empty when supplied. When omitted, the server selects `DEFAULT_EMAIL_ACCOUNT` or the first configured account. Configuration and provider settings are described in the [README](../README.md).

Email IDs are **IMAP UIDs represented as positive numeric strings**, scoped to the selected account's INBOX. They are not sequence numbers or Internet Message-ID header values. A move can change a message's UID in its destination folder. These tools search, retrieve and modify messages in INBOX; a destination path can be supplied when moving a message.

## `accounts_list`

Lists every configured account and identifies the default. This tool takes an empty input object `{}` and does not select an individual account or connect to its mail servers.

Response:

| Field | Type | Meaning |
| --- | --- | --- |
| `success` | boolean | `true` when configuration was loaded. |
| `count` | integer | Number of configured accounts. |
| `default_account` | string | Selected default account name. |
| `accounts` | array | One account summary per configured account. |

Each account summary contains `name` (string), `is_default` (boolean), `smtp_configured` (boolean), `imap_configured` (boolean) and `sender_count` (integer). The configured flags report the presence of host settings, not a successful provider connection. Credentials are not returned.

Example response:

```json
{"success":true,"count":1,"default_account":"work","accounts":[{"name":"work","is_default":true,"smtp_configured":true,"imap_configured":true,"sender_count":1}]}
```

## `emails_find`

Finds messages in INBOX. All inputs are optional:

| Input | Type | Default / behavior |
| --- | --- | --- |
| `account_name` | string | Default account selection as described above. |
| `query` | string | Text searched across subject, body, sender and recipients. Blank text adds no text condition. |
| `filters` | object | Structured filters listed below. |
| `limit` | integer | `20`; must be between `1` and `100` inclusive. |
| `include_content` | boolean | `false`; includes the message body when `true`. |
| `include_attachments` | boolean | `false`; includes attachment bytes encoded as base64 when `true`. |

`filters` accepts these optional properties:

| Filter | Type | Behavior |
| --- | --- | --- |
| `from`, `to`, `subject` | string | Non-empty sender, recipient or subject search text. |
| `has_attachments` | boolean | `true` selects messages with attachments; `false` selects messages without them. |
| `is_unread` | boolean | `true` selects unread messages; `false` selects read messages. |
| `is_flagged` | boolean | `true` selects flagged messages; `false` selects unflagged messages. |
| `after_date` | string | A valid date; `YYYY-MM-DD` is recommended. Maps to IMAP `SINCE`, which includes the specified calendar date. |
| `before_date` | string | A valid date; `YYYY-MM-DD` is recommended. Maps to IMAP `BEFORE`, which excludes the specified calendar date. |

Structured conditions are combined; the text query matches any of its four fields. Date search uses the IMAP server's date semantics. Returned messages are sorted by their returned `date` in descending order.

Response: `success` (boolean), `account` (string), `total_found` (integer), `count` (integer) and `emails` (array of message objects). Both counters equal the length of the returned array, **not the total number of matching messages in the mailbox**. At most `limit` messages are returned; this interface has no pagination cursor.

Message objects:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | IMAP UID to use in subsequent calls. |
| `thread_id` | optional string | Provider thread identifier, when supplied by the server. |
| `message_id` | optional string | Internet Message-ID header. |
| `subject` | string | Subject, or `(No Subject)` if absent. |
| `from` | string | First sender formatted from its name/address, or `Unknown`. |
| `reply_to` | optional string | First Reply-To address when available. |
| `to`, `cc` | string arrays | Formatted recipient addresses; empty arrays when absent. |
| `date` | string | ISO timestamp from the message envelope; current time is used if the envelope has no date. |
| `snippet` | optional string | Up to the first 200 characters of the parsed body when it is included and non-empty. |
| `body` | optional string | Parsed body when `include_content` is `true`; HTML is preferred, followed by text converted to HTML or plain text. |
| `is_unread`, `is_flagged` | boolean | Read and flag state. |
| `has_attachments` | boolean | Whether the IMAP body structure identifies an attachment. |
| `attachments` | optional array | Attachment objects when requested and present; see Attachment format below. |

Example call arguments:

```json
{"account_name":"work","filters":{"is_unread":true,"after_date":"2026-10-01"},"limit":5,"include_content":true}
```

An empty result is `{"success":true,"account":"work","total_found":0,"count":0,"emails":[]}`.

## `emails_modify`

Applies one or more changes to messages in INBOX:

| Input | Type | Required / behavior |
| --- | --- | --- |
| `account_name` | string | Optional account selection. |
| `email_ids` | string array | Required, non-empty; every entry must be a positive numeric UID. |
| `mark_read`, `mark_unread` | boolean | Optional; set the corresponding read state when `true`. Both cannot be `true`. |
| `flag`, `unflag` | boolean | Optional; set or clear the flagged state when `true`. Both cannot be `true`. |
| `move_to_folder` | string | Optional, non-empty destination folder path. |

At least one change must be requested. A supplied flag with value `false` does not request a change. Destination folder names are provider-specific and can be obtained with `folders_list`.

Response: `success` (boolean), `account` (string), `modified` (integer), `total` (integer) and optional `errors` (string array). `total` equals the number of requested IDs; `modified` counts IDs whose requested operations completed. Individual failures return `success: false` with `errors`, while retaining successful changes. Operations are not transactional: a flag change can succeed before a later move fails for the same message. Check both the counts and errors before retrying.

Example call arguments: `{"account_name":"work","email_ids":["42"],"mark_read":true}`.

Example response: `{"success":true,"account":"work","modified":1,"total":1}`.

## `email_send`

Sends a new message through SMTP:

| Input | Type | Required / default |
| --- | --- | --- |
| `account_name` | string | Optional account selection. |
| `to` | string array | Required, non-empty; every entry must be a non-empty string. |
| `subject`, `body` | string | Required and non-empty. |
| `body_type` | `"plain"` or `"html"` | Optional; defaults to `"html"`. |
| `from_email` | string | Optional, non-empty sender address. If the account has a `sender_emails` allowlist, it must match an entry, case-insensitively. |
| `cc`, `bcc` | string array | Optional; empty arrays are accepted. Each supplied entry must be non-empty. |
| `attachments` | array | Optional attachment objects, described below. |

The default sender is the first configured `sender_emails` entry, or the SMTP login when no allowlist is configured. The configured default sender name is used when available. Recipient strings are passed to the mail transport; these checks do not constitute verification that an address exists.

Response: `success` (boolean), `account` (string), `message_id` (string), `to` (string array) and `subject` (string). Success reports the SMTP operation and generated Message-ID; it does not confirm delivery to a recipient's inbox.

Example call arguments:

```json
{"account_name":"work","to":["recipient@example.test"],"subject":"Example update","body":"This is a fictional example.","body_type":"plain"}
```

Example response:

```json
{"success":true,"account":"work","message_id":"<fictional-message@example.test>","to":["recipient@example.test"],"subject":"Example update"}
```

## `email_respond`

Replies to or forwards an existing INBOX message:

| Input | Type | Required / default |
| --- | --- | --- |
| `account_name` | string | Optional account selection. |
| `email_id` | string | Required positive numeric IMAP UID. |
| `body` | string | Required and non-empty response text. |
| `response_type` | `"reply"`, `"reply_all"` or `"forward"` | Optional; defaults to `"reply"`. |
| `body_type` | `"plain"` or `"html"` | Optional; defaults to `"html"`. |
| `to` | string array | Required and non-empty for forwarding. Optional for replies; a non-empty array overrides calculated recipients. An empty reply override uses calculated recipients. |
| `include_original` | boolean | Optional; defaults to `true`, appending the original body when available. |
| `include_attachments` | boolean | Optional; defaults to `true`, retaining original attachments when present. |
| `additional_attachments` | array | Optional attachment objects to add. |

Replies use the original Reply-To address when available, otherwise the original sender. `reply_all` also includes original To/CC recipients, removing duplicate added addresses and the account's SMTP login/sender aliases. Replies add `Re:` when needed and set In-Reply-To/References from the original Message-ID. Forwards add `Fwd:` when needed. The sender is the account's default sender.

Response: `success` (boolean), `account` (string), `message_id` (string), `response_type` (string) and `original_email_id` (string). As with `email_send`, SMTP success is not a recipient-delivery confirmation.

Example call arguments: `{"account_name":"work","email_id":"42","response_type":"reply","body":"Example reply.","body_type":"plain","include_original":false,"include_attachments":false}`.

Example response: `{"success":true,"account":"work","message_id":"<fictional-reply@example.test>","response_type":"reply","original_email_id":"42"}`.

## `folders_list`

Lists the selected account's folders:

| Input | Type | Default |
| --- | --- | --- |
| `account_name` | string | Optional account selection. |
| `include_counts` | boolean | Optional; `false`. Requests total and unread counts for each folder when `true`. |

Response: `success` (boolean), `account` (string), `count` (integer) and `folders` (array). Each folder has `name` and `path` strings. `total_count` and `unread_count` are optional integers, included when counts are requested and the provider status request succeeds. A folder can still be returned when its count request fails.

Example response: `{"success":true,"account":"work","count":1,"folders":[{"name":"INBOX","path":"INBOX","total_count":12,"unread_count":3}]}`.

## Attachment format

Both outgoing attachment inputs and returned attachment objects use `filename` (string), `content` (base64-encoded string) and optional `content_type` (MIME-type string). Each outgoing entry requires `filename` and `content`. The handler checks their string types; it does not enforce canonical base64 syntax. Incoming attachments without a filename are named `unnamed`.

Fictional attachment example: `{"filename":"example.txt","content":"RXhhbXBsZS4=","content_type":"text/plain"}`.

## Errors and partial results

Configuration, argument validation and connection failures normally return `{"success":false,"error":"message"}` inside the MCP text result, with `isError: true` on the MCP result. Unknown tool names use the same error wrapper. Malformed MCP protocol requests can instead be rejected by the MCP SDK at the protocol layer.

Examples of validation messages include `limit must be an integer between 1 and 100`, `email_ids entries must be positive numeric UIDs`, `mark_read and mark_unread cannot both be true`, `body_type must be plain or html`, and `to is required for forward`. Invalid account names and provider connection/authentication failures also return errors. Provider-dependent messages are not a fixed enumeration.

For `emails_modify`, partial failures use the tool-specific `account`, `modified`, `total` and `errors` fields described above, rather than the single `error` property. Inspect `success` even when a response contains useful partial results.
