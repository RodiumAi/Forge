import random

secret = random.randint(1, 100)
essais = 0

print("J'ai choisi un nombre entre 1 et 100.")
while True:
    proposition = int(input("Votre proposition : "))
    essais += 1
    if proposition < secret:
        print("C'est plus !")
    elif proposition > secret:
        print("C'est moins !")
    else:
        print(f"Bravo, trouvé en {essais} essais !")
        break
