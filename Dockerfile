# Usa un'immagine base con Node.js
FROM node:20

# Imposta la directory di lavoro all'interno del container
WORKDIR /usr/src/app

# Copia i file package per installare le dipendenze
COPY package*.json ./

# Installa le dipendenze
RUN npm install

# Copia tutto il resto del codice
COPY . .

# Compila TypeScript
RUN npm run build

# Esponi la porta (se usi Express per l'interfaccia HTTP)
EXPOSE 3000

# Avvia l'app
CMD ["npm", "start"]
