.PHONY: frontend backend verify docker

frontend:
	cd frontend && npm install && npm run dev

backend:
	cd backend && mvn spring-boot:run

verify:
	cd frontend && npm run verify && npm run build
	cd backend && mvn test

docker:
	docker compose up --build
