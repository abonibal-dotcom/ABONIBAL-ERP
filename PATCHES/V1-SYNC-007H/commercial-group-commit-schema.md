# V1-SYNC-007H Commercial Group Commit Schema

## Path

`accounts/{accountId}/commercialGroupCommits/{publicationId}`

The publication ID is deterministic and equals the trusted command ID.

## Marker Evidence

The versioned marker records:

- logical `accountId`;
- `publicationId`, command ID/type, target Return ID, and request checksum;
- allocation commit checksum and Invoice allocation root identity;
- final InvoiceReturn checksum and revision;
- every movement ID, Return line ID, Invoice line ID, and record checksum;
- accepted receipt result checksum;
- document-number allocation reference and proof checksum;
- trusted commit time and terminal `committed` status;
- a canonical publication checksum over the complete marker body.

The marker is written only in the same atomic update as every published member.
Its presence with a missing or divergent member is treated as
`PARTIAL_PUBLICATION_STATE_CONFLICT`, never repaired by blind overwrite.

Client mutation of this path is denied by current TEST default-deny rules.
V1-SYNC-007H does not change or deploy rules.
