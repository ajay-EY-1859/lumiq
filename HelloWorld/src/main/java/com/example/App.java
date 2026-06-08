package com.example;

public class App {

    public String greet(String name) {
        if (name == null || name.isBlank()) {
            return "Hello, World!";
        }
        return "Hello, " + name.trim() + "!";
    }

    public static void main(String[] args) {
        App app = new App();
        System.out.println(app.greet(args.length > 0 ? args[0] : "World"));
    }
}
