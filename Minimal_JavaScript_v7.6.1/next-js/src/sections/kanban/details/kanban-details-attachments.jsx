import { useState, useCallback } from 'react';

import { UploadBox, MultiFilePreview } from 'src/components/upload';

// ----------------------------------------------------------------------

export function KanbanDetailsAttachments({ attachments }) {
  const [files, setFiles] = useState(attachments);

  const handleDrop = useCallback(
    (acceptedFiles) => {
      setFiles([...files, ...acceptedFiles]);
    },
    [files]
  );

  const handleRemoveFile = useCallback(
    (inputFile) => {
      const filtered = files.filter((file) => file !== inputFile);
      setFiles(filtered);
    },
    [files]
  );

  return (
    <MultiFilePreview
      files={files}
      onRemove={(file) => handleRemoveFile(file)}
      endNode={<UploadBox onDrop={handleDrop} />}
      thumbnail={{ sx: { width: 64, height: 64 } }}
    />
  );
}
