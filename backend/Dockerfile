FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml .springjavaformatconfig ./
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline
COPY src src
RUN ./mvnw -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --system payflow && useradd --system --gid payflow payflow
COPY --from=build /app/target/backend-0.0.1-SNAPSHOT.jar app.jar
USER payflow
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
