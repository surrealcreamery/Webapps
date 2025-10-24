import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material'; // CORRECTED IMPORT
import CloseIcon from '@mui/icons-material/Close'; // CORRECTED IMPORT
import GoogleIcon from '@mui/icons-material/Google'; // CORRECTED IMPORT
import PropTypes from 'prop-types';

const useScript = (url, onload) => {
  React.useEffect(() => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.defer = true;
    script.onload = onload;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [url, onload]);
};

const GoogleDriveFileListerModal = ({
  open,
  onClose,
  onProcessFile,
  setSnackbar,
}) => {
  const [oauthToken, setOauthToken] = React.useState(null);
  const [fileList, setFileList] = React.useState([]);
  const [selectedFile, setSelectedFile] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const googleClientId =
    '103550868041-bjrkr85jh4fk3gmmi6ie5ir1ikl63vfj.apps.googleusercontent.com';
  const TARGET_FOLDER_NAME = 'Reports';

  useScript('https://accounts.google.com/gsi/client', () => {
    if (window.google?.accounts?.oauth2) {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope:
          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
        callback: (tokenResponse) => {
          if (tokenResponse.error) {
            setError(`Authentication failed: ${tokenResponse.error}`);
            return;
          }
          setOauthToken(tokenResponse);
        },
      });
      window.tokenClient = tokenClient;
    }
  });

  const handleAuthClick = () => {
    if (window.tokenClient) {
      window.tokenClient.requestAccessToken({ prompt: 'select_account' });
    } else {
      setError('Google Auth client is not ready.');
    }
  };

  React.useEffect(() => {
    if (open && oauthToken) {
      const fetchFiles = async () => {
        setIsLoading(true);
        setError(null);
        setFileList([]);
        setSelectedFile(null);
        let folderId = null;

        try {
          const folderQuery = `name='${TARGET_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
          const folderRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
              folderQuery,
            )}`,
            {
              headers: { Authorization: `Bearer ${oauthToken.access_token}` },
            },
          );
          if (!folderRes.ok) throw new Error('Failed to search for folder.');
          const folderData = await folderRes.json();
          if (folderData.files && folderData.files.length > 0) {
            folderId = folderData.files[0].id;
          } else {
            throw new Error(`Folder "${TARGET_FOLDER_NAME}" not found.`);
          }

          const fileQuery = `'${folderId}' in parents and (mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='text/csv') and trashed=false`;
          const filesRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
              fileQuery,
            )}&fields=files(id,name,size)`,
            {
              headers: { Authorization: `Bearer ${oauthToken.access_token}` },
            },
          );
          if (!filesRes.ok) throw new Error('Failed to list files.');
          const filesData = await filesRes.json();
          setFileList(filesData.files || []);
        } catch (err) {
          setError(err.message);
          setSnackbar({
            open: true,
            message: err.message,
            severity: 'error',
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchFiles();
    }
  }, [open, oauthToken, setSnackbar]);

  const handleProcess = () => {
    if (selectedFile) {
      onProcessFile(selectedFile);
    }
  };

  const handleClose = () => {
    setError(null);
    setFileList([]);
    setSelectedFile(null);
    setOauthToken(null); // Reset auth token on close to allow re-authentication
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        Select Report from Google Drive
        <IconButton aria-label="close" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ minHeight: 280 }}>
        {!oauthToken ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <Typography sx={{ mb: 2 }}>
              Please sign in to list files from your Google Drive.
            </Typography>
            <Button
              variant="contained"
              startIcon={<GoogleIcon />}
              onClick={handleAuthClick}
            >
              Sign In with Google
            </Button>
            {error && (
              <Typography color="error" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
          </Box>
        ) : isLoading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Fetching files...</Typography>
          </Box>
        ) : (
          <List>
            {fileList.length > 0 ? (
              fileList.map((file) => (
                <ListItemButton
                  key={file.id}
                  selected={selectedFile?.id === file.id}
                  onClick={() => setSelectedFile(file)}
                >
                  <ListItemText
                    primary={file.name}
                    secondary={
                      file.size
                        ? `Size: ${Math.round(file.size / 1024)} KB`
                        : ''
                    }
                  />
                </ListItemButton>
              ))
            ) : (
              <Typography
                sx={{ textAlign: 'center', color: 'text.secondary', p: 4 }}
              >
                No spreadsheet or CSV files found in the "{TARGET_FOLDER_NAME}"
                folder.
              </Typography>
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleProcess}
          variant="contained"
          disabled={!selectedFile || isLoading}
        >
          Process File
        </Button>
      </DialogActions>
    </Dialog>
  );
};

GoogleDriveFileListerModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onProcessFile: PropTypes.func.isRequired,
  setSnackbar: PropTypes.func.isRequired,
};

export default GoogleDriveFileListerModal;