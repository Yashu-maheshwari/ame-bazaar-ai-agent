# Use the official n8n Docker image as the base
FROM n8nio/n8n

# Ensure n8n binds to 0.0.0.0 on all network interfaces for cloud routing
ENV N8N_LISTEN_ADDRESS=0.0.0.0
ENV N8N_PORT=5678
EXPOSE 5678
