.PHONY: up down logs doctor frontend backend verify docker

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

doctor:
	./check.sh

frontend:
	cd frontend && npm install && npm run dev

backend:
	cd backend && mvn spring-boot:run

verify:
	cd frontend && npm run verify && npm run build
	cd backend && mvn test
	docker compose config --quiet

docker: up
